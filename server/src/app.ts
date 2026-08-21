import cors from 'cors';
import express from 'express';
import { Prisma } from '@prisma/client';
import { ok } from './common/api-response.js';
import { resolveAvatarUrl } from './common/avatar-url.js';
import { HttpError } from './common/http-error.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { createRequireAuthMiddleware } from './middlewares/auth.js';
import { errorHandler } from './middlewares/error-handler.js';
import { createAlbumsRouter } from './modules/albums/albums.routes.js';
import { createAlbumsService } from './modules/albums/albums.service.js';
import { createAssistantRouter } from './modules/assistant/assistant.routes.js';
import { createAssistantService } from './modules/assistant/assistant.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createFriendsRouter } from './modules/friends/friends.routes.js';
import { createFriendsService } from './modules/friends/friends.service.js';
import { createMessagesRouter } from './modules/messages/messages.routes.js';
import { createMessagesService } from './modules/messages/messages.service.js';
import { createSmtpEmailSender } from './modules/email/smtp-mailer.js';
import { createPhotosRouter } from './modules/photos/photos.routes.js';
import { createPhotosService } from './modules/photos/photos.service.js';
import { createSharedSpacesRouter } from './modules/shared-spaces/shared-spaces.routes.js';
import { createSharedSpacesService } from './modules/shared-spaces/shared-spaces.service.js';
import { createTrashRouter } from './modules/trash/trash.routes.js';
import { createTrashService } from './modules/trash/trash.service.js';
import { createOssService } from './modules/uploads/oss.service.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createUsersService } from './modules/users/users.service.js';

const translateAuthUniqueConstraintError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];

    if (target.includes('email')) {
      throw new HttpError(409, 'EMAIL_ALREADY_IN_USE', 'Email is already in use');
    }

    if (target.includes('username')) {
      throw new HttpError(409, 'USERNAME_ALREADY_IN_USE', 'Username is already in use');
    }

    if (target.includes('personalId')) {
      throw new HttpError(409, 'PERSONAL_ID_ALREADY_IN_USE', 'Personal ID is already in use');
    }
  }

  throw error;
};

const isPrismaKnownRequestError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export const buildApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json(ok({ status: 'ok' }));
  });

  const ossService = createOssService(env.oss);
  const signUserAvatar = <T extends { avatarUrl: string | null; avatarObjectKey?: string | null }>(
    user: T,
  ): T => ({
    ...user,
    avatarUrl: resolveAvatarUrl(user, ossService),
  });
  const authService = createAuthService({
    jwtSecret: env.jwtSecret,
    usersRepository: {
      findByEmail: (email) => prisma.user.findUnique({ where: { email } }),
      findByUsername: (username) => prisma.user.findUnique({ where: { username } }),
      findByPersonalId: (personalId) => prisma.user.findUnique({ where: { personalId } }),
      findById: (id) => prisma.user.findUnique({ where: { id } }),
      create: async (input) => {
        try {
          return await prisma.user.create({ data: input });
        } catch (error) {
          translateAuthUniqueConstraintError(error);
        }
      },
    },
    emailVerificationRepository: {
      create: (input) =>
        prisma.emailVerificationCode.create({
          data: input,
        }),
      countRecent: (email, since) =>
        prisma.emailVerificationCode.count({
          where: {
            email,
            createdAt: {
              gte: since,
            },
          },
        }),
      findLatestUsable: (email, now) =>
        prisma.emailVerificationCode.findFirst({
          where: {
            email,
            usedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
      markUsed: async (id, usedAt) => {
        await prisma.emailVerificationCode.update({
          where: { id },
          data: { usedAt },
        });
      },
    },
    emailSender: createSmtpEmailSender(env.smtp),
    resolveAvatarUrl: (user) => resolveAvatarUrl(user, ossService),
  });
  const assistantService = createAssistantService(env.mimo);
  const signPhotoUrl = <T extends { objectKey: string; url: string }>(photo: T): T => ({
    ...photo,
    url: ossService.getObjectUrl(photo.objectKey),
  });
  const signTrashPhotoUrl = <T extends { photo: { objectKey: string; url: string } }>(
    item: T,
  ): T => ({
    ...item,
    photo: signPhotoUrl(item.photo),
  });
  const usersService = createUsersService({
    usersRepository: {
      findById: (id) => prisma.user.findUnique({ where: { id } }),
      updateProfile: (id, input) =>
        prisma.user.update({
          where: { id },
          data: input,
        }),
      getStorageSummary: async (userId) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });

        if (!user) {
          return null;
        }

        const [aggregate, photoCount] = await prisma.$transaction([
          prisma.photo.aggregate({
            where: { uploadedById: userId },
            _sum: { size: true },
          }),
          prisma.photo.count({
            where: { uploadedById: userId },
          }),
        ]);

        return {
          usedBytes: aggregate._sum.size ?? 0,
          photoCount,
        };
      },
    },
    uploadSigner: ossService,
  });
  const albumsService = createAlbumsService({
    async listByOwner(ownerId) {
      return prisma.album.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
      });
    },
    async listWithPhotosByOwner(ownerId) {
      const albums = await prisma.album.findMany({
        where: { ownerId },
        include: {
          photos: {
            where: {
              trashItem: null,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return albums.map(({ photos, ...album }) => ({
        ...album,
        photos: photos.map(signPhotoUrl),
      }));
    },
    async findByIdForOwner(albumId, ownerId) {
      return prisma.album.findFirst({
        where: {
          id: albumId,
          ownerId,
        },
      });
    },
    async listPhotos(albumId) {
      const photos = await prisma.photo.findMany({
        where: {
          albumId,
          trashItem: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      return photos.map(signPhotoUrl);
    },
    async create(input) {
      return prisma.album.create({
        data: input,
      });
    },
  });
  const photosService = createPhotosService({
    albumsRepository: {
      async findOwnedAlbum(albumId, ownerId) {
        return prisma.album.findFirst({
          where: {
            id: albumId,
            ownerId,
          },
          select: {
            id: true,
            ownerId: true,
          },
        });
      },
    },
    photosRepository: {
      async create(input) {
        return prisma.photo.create({
          data: input,
        });
      },
      async findOwnedPhoto(photoId, ownerId) {
        return prisma.photo.findFirst({
          where: {
            id: photoId,
            album: {
              ownerId,
            },
          },
        });
      },
      async updateAiTitle(photoId, aiTitle) {
        return signPhotoUrl(
          await prisma.photo.update({
            where: { id: photoId },
            data: { aiTitle },
          }),
        );
      },
      async updateFavorite(photoId, isFavorite) {
        return signPhotoUrl(
          await prisma.photo.update({
            where: { id: photoId },
            data: { isFavorite },
          }),
        );
      },
      async findTrashItemByPhotoId(photoId) {
        return prisma.trashItem.findUnique({
          where: { photoId },
        });
      },
      async createTrashItemIfAbsent(input) {
        try {
          return await prisma.trashItem.create({
            data: input,
          });
        } catch (error) {
          if (!isPrismaKnownRequestError(error, 'P2002')) {
            throw error;
          }

          const existingTrashItem = await prisma.trashItem.findUnique({
            where: { photoId: input.photoId },
          });

          if (!existingTrashItem) {
            throw error;
          }

          return existingTrashItem;
        }
      },
    },
    uploadSigner: ossService,
    photoTitleGenerator: assistantService,
  });
  const trashService = createTrashService({
    trashRepository: {
      async listByOwner(ownerId) {
        const trashItems = await prisma.trashItem.findMany({
          where: { deletedById: ownerId },
          include: { photo: true },
          orderBy: { createdAt: 'desc' },
        });

        return trashItems.map(signTrashPhotoUrl);
      },
      async findByPhotoIdForOwner(photoId, ownerId) {
        const trashItem = await prisma.trashItem.findFirst({
          where: {
            photoId,
            deletedById: ownerId,
          },
          include: { photo: true },
        });

        return trashItem ? signTrashPhotoUrl(trashItem) : null;
      },
      async deleteByPhotoId(photoId) {
        try {
          await prisma.trashItem.delete({
            where: { photoId },
          });

          return true;
        } catch (error) {
          if (isPrismaKnownRequestError(error, 'P2025')) {
            return false;
          }

          throw error;
        }
      },
      async hardDeletePhoto(photoId) {
        try {
          await prisma.photo.delete({
            where: { id: photoId },
          });

          return true;
        } catch (error) {
          if (isPrismaKnownRequestError(error, 'P2025')) {
            return false;
          }

          throw error;
        }
      },
    },
    objectStorage: ossService,
  });
  const friendsService = createFriendsService({
    async findUserById(userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          personalId: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          avatarObjectKey: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user ? signUserAvatar(user) : null;
    },
    async findUserByPersonalId(personalId) {
      const user = await prisma.user.findUnique({
        where: { personalId },
        select: {
          id: true,
          personalId: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          avatarObjectKey: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user ? signUserAvatar(user) : null;
    },
    async listFriends(userId) {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        include: {
          userA: {
            select: {
              id: true,
              personalId: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              avatarObjectKey: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          userB: {
            select: {
              id: true,
              personalId: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              avatarObjectKey: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return friendships.map((friendship) =>
        signUserAvatar(friendship.userAId === userId ? friendship.userB : friendship.userA),
      );
    },
    async listInvitations(userId) {
      const invitations = await prisma.friendInvitation.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        include: {
          sender: {
            select: {
              id: true,
              personalId: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              avatarObjectKey: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          receiver: {
            select: {
              id: true,
              personalId: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              avatarObjectKey: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return invitations.map((invitation) => ({
        ...invitation,
        sender: signUserAvatar(invitation.sender),
        receiver: signUserAvatar(invitation.receiver),
      }));
    },
    async findFriendshipByPair(userAId, userBId) {
      return prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
      });
    },
    async findInvitationByPair(pairUserAId, pairUserBId) {
      return prisma.friendInvitation.findUnique({
        where: {
          pairUserAId_pairUserBId: {
            pairUserAId,
            pairUserBId,
          },
        },
      });
    },
    async createInvitation(input) {
      try {
        return await prisma.friendInvitation.create({
          data: {
            ...input,
            status: 'PENDING',
          },
        });
      } catch (error) {
        if (!isPrismaKnownRequestError(error, 'P2002')) {
          throw error;
        }

        throw new HttpError(
          409,
          'FRIEND_INVITATION_ALREADY_EXISTS',
          'Friend invitation already exists',
        );
      }
    },
    async resetInvitation(invitationId, input) {
      return prisma.friendInvitation.update({
        where: { id: invitationId },
        data: input,
      });
    },
    async findReceivedInvitation(invitationId, receiverId) {
      return prisma.friendInvitation.findFirst({
        where: {
          id: invitationId,
          receiverId,
        },
      });
    },
    async acceptPendingInvitation(invitationId, receiverId) {
      return prisma.$transaction(async (transaction) => {
        const updateResult = await transaction.friendInvitation.updateMany({
          where: {
            id: invitationId,
            receiverId,
            status: 'PENDING',
          },
          data: { status: 'ACCEPTED' },
        });

        if (updateResult.count === 0) {
          return null;
        }

        const invitation = await transaction.friendInvitation.findUnique({
          where: { id: invitationId },
        });

        if (!invitation) {
          return null;
        }

        let friendship;

        try {
          friendship = await transaction.friendship.create({
            data: {
              userAId: invitation.pairUserAId,
              userBId: invitation.pairUserBId,
            },
          });
        } catch (error) {
          if (!isPrismaKnownRequestError(error, 'P2002')) {
            throw error;
          }

          friendship = await transaction.friendship.findUnique({
            where: {
              userAId_userBId: {
                userAId: invitation.pairUserAId,
                userBId: invitation.pairUserBId,
              },
            },
          });

          if (!friendship) {
            throw error;
          }
        }

        return {
          invitation,
          friendship,
        };
      });
    },
    async rejectPendingInvitation(invitationId, receiverId) {
      return prisma.$transaction(async (transaction) => {
        const updateResult = await transaction.friendInvitation.updateMany({
          where: {
            id: invitationId,
            receiverId,
            status: 'PENDING',
          },
          data: { status: 'REJECTED' },
        });

        if (updateResult.count === 0) {
          return null;
        }

        return transaction.friendInvitation.findUnique({
          where: { id: invitationId },
        });
      });
    },
  });
  const messagesService = createMessagesService({
    findUserById: (userId) =>
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
    async areFriends(userId, otherUserId) {
      const [userAId, userBId] = [userId, otherUserId].sort();
      const friendship = await prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
        select: { id: true },
      });

      return Boolean(friendship);
    },
    listConversation(userId, friendId) {
      return prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: friendId },
            { senderId: friendId, receiverId: userId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
    },
    createMessage(input) {
      return prisma.message.create({
        data: input,
      });
    },
  });
  const sharedSpacesService = createSharedSpacesService({
    async createSpace(input) {
      return prisma.sharedSpace.create({
        data: input,
      });
    },
    async updateSpace(spaceId, input) {
      return prisma.sharedSpace.update({
        where: { id: spaceId },
        data: input,
      });
    },
    async listAccessibleSpaces(userId) {
      return prisma.sharedSpace.findMany({
        where: {
          OR: [
            { ownerId: userId },
            {
              members: {
                some: {
                  userId,
                  status: 'ACTIVE',
                },
              },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    },
    async listAccessibleSpacesWithDetails(userId) {
      const spaces = await prisma.sharedSpace.findMany({
        where: {
          OR: [
            { ownerId: userId },
            {
              members: {
                some: {
                  userId,
                  status: 'ACTIVE',
                },
              },
            },
          ],
        },
        include: {
          members: {
            orderBy: { createdAt: 'asc' },
          },
          photos: {
            where: {
              photo: {
                trashItem: null,
              },
            },
            include: {
              photo: true,
              sharedBy: {
                select: {
                  id: true,
                  personalId: true,
                  username: true,
                  email: true,
                  displayName: true,
                  avatarUrl: true,
                  avatarObjectKey: true,
                  bio: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return spaces.map(({ members, photos, ...space }) => ({
        ...space,
        members,
        photos: photos.map((sharedPhoto) => ({
          ...sharedPhoto,
          photo: signPhotoUrl(sharedPhoto.photo),
          sharedBy: signUserAvatar(sharedPhoto.sharedBy),
        })),
      }));
    },
    async findSpaceById(spaceId) {
      return prisma.sharedSpace.findUnique({
        where: { id: spaceId },
      });
    },
    async findMembership(spaceId, userId) {
      return prisma.sharedSpaceMember.findUnique({
        where: {
          sharedSpaceId_userId: {
            sharedSpaceId: spaceId,
            userId,
          },
        },
      });
    },
    async listMembers(spaceId) {
      return prisma.sharedSpaceMember.findMany({
        where: { sharedSpaceId: spaceId },
        orderBy: { createdAt: 'asc' },
      });
    },
    async createMemberIfAbsent(input) {
      try {
        return await prisma.sharedSpaceMember.create({
          data: input,
        });
      } catch (error) {
        if (!isPrismaKnownRequestError(error, 'P2002')) {
          throw error;
        }

        const existingMember = await prisma.sharedSpaceMember.findUnique({
          where: {
            sharedSpaceId_userId: {
              sharedSpaceId: input.sharedSpaceId,
              userId: input.userId,
            },
          },
        });

        if (!existingMember) {
          throw error;
        }

        if (['LEFT', 'REMOVED'].includes(existingMember.status)) {
          return prisma.sharedSpaceMember.update({
            where: {
              sharedSpaceId_userId: {
                sharedSpaceId: input.sharedSpaceId,
                userId: input.userId,
              },
            },
            data: { status: input.status },
          });
        }

        return existingMember;
      }
    },
    async areFriends(userId, otherUserId) {
      const [userAId, userBId] = [userId, otherUserId].sort();
      const friendship = await prisma.friendship.findUnique({
        where: {
          userAId_userBId: {
            userAId,
            userBId,
          },
        },
        select: { id: true },
      });

      return Boolean(friendship);
    },
    async listPhotos(spaceId) {
      const sharedPhotos = await prisma.sharedSpacePhoto.findMany({
        where: {
          sharedSpaceId: spaceId,
          photo: {
            trashItem: null,
          },
        },
        include: {
          photo: true,
          sharedBy: {
            select: {
              id: true,
              personalId: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              avatarObjectKey: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return sharedPhotos.map((sharedPhoto) => ({
        ...sharedPhoto,
        photo: signPhotoUrl(sharedPhoto.photo),
        sharedBy: signUserAvatar(sharedPhoto.sharedBy),
      }));
    },
    async findSharedPhoto(spaceId, sharedPhotoId) {
      const sharedPhoto = await prisma.sharedSpacePhoto.findFirst({
        where: {
          id: sharedPhotoId,
          sharedSpaceId: spaceId,
        },
        include: {
          photo: true,
          sharedBy: {
            select: {
              id: true,
              personalId: true,
              username: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              avatarObjectKey: true,
              bio: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!sharedPhoto) {
        return null;
      }

      return {
        ...sharedPhoto,
        photo: signPhotoUrl(sharedPhoto.photo),
        sharedBy: signUserAvatar(sharedPhoto.sharedBy),
      };
    },
    async createTrashItemIfAbsent(input) {
      try {
        return await prisma.trashItem.create({
          data: input,
        });
      } catch (error) {
        if (!isPrismaKnownRequestError(error, 'P2002')) {
          throw error;
        }

        const existingTrashItem = await prisma.trashItem.findUnique({
          where: { photoId: input.photoId },
        });

        if (!existingTrashItem) {
          throw error;
        }

        return existingTrashItem;
      }
    },
    async findOwnedPhoto(photoId, ownerId) {
      return prisma.photo.findFirst({
        where: {
          id: photoId,
          album: {
            ownerId,
          },
        },
        select: {
          id: true,
          albumId: true,
          uploadedById: true,
        },
      });
    },
    async createSharedPhotoIfAbsent(input) {
      try {
        const sharedPhoto = await prisma.sharedSpacePhoto.create({
          data: input,
          include: {
            photo: true,
            sharedBy: {
              select: {
                id: true,
                personalId: true,
                username: true,
                email: true,
                displayName: true,
                avatarUrl: true,
                avatarObjectKey: true,
                bio: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        return {
          ...sharedPhoto,
          photo: signPhotoUrl(sharedPhoto.photo),
          sharedBy: signUserAvatar(sharedPhoto.sharedBy),
        };
      } catch (error) {
        if (!isPrismaKnownRequestError(error, 'P2002')) {
          throw error;
        }

        const existingSharedPhoto = await prisma.sharedSpacePhoto.findFirst({
          where: {
            sharedSpaceId: input.sharedSpaceId,
            photoId: input.photoId,
          },
          include: {
            photo: true,
            sharedBy: {
              select: {
                id: true,
                personalId: true,
                username: true,
                email: true,
                displayName: true,
                avatarUrl: true,
                avatarObjectKey: true,
                bio: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        if (!existingSharedPhoto) {
          throw error;
        }

        return {
          ...existingSharedPhoto,
          photo: signPhotoUrl(existingSharedPhoto.photo),
          sharedBy: signUserAvatar(existingSharedPhoto.sharedBy),
        };
      }
    },
    async findDefaultUploadAlbum(ownerId) {
      return prisma.album.findFirst({
        where: {
          ownerId,
          title: '共享上传',
        },
        orderBy: { createdAt: 'asc' },
      });
    },
    async createDefaultUploadAlbum(ownerId) {
      return prisma.album.create({
        data: {
          ownerId,
          title: '共享上传',
          description: '共享空间上传的照片和视频',
        },
      });
    },
    async createPhoto(input) {
      return prisma.photo.create({
        data: input,
      });
    },
    createUploadToken(input) {
      return ossService.createImageUploadToken(input);
    },
    getObjectUrl(objectKey) {
      return ossService.getObjectUrl(objectKey);
    },
  });
  const requireAuth = createRequireAuthMiddleware(authService);

  app.use('/api/auth', createAuthRouter(authService));
  app.use(
    '/api/albums',
    createAlbumsRouter({
      requireAuth,
      albumsService,
    }),
  );
  app.use(
    '/api/photos',
    createPhotosRouter({
      requireAuth,
      photosService,
    }),
  );
  app.use(
    '/api/trash',
    createTrashRouter({
      requireAuth,
      trashService,
    }),
  );
  app.use(
    '/api/users',
    createUsersRouter({
      requireAuth,
      usersService,
    }),
  );
  app.use(
    '/api/friends',
    createFriendsRouter({
      requireAuth,
      friendsService,
    }),
  );
  app.use(
    '/api/messages',
    createMessagesRouter({
      requireAuth,
      messagesService,
    }),
  );
  app.use(
    '/api/assistant',
    createAssistantRouter({
      requireAuth,
      assistantService,
    }),
  );
  app.use(
    '/api/shared-spaces',
    createSharedSpacesRouter({
      requireAuth,
      sharedSpacesService,
    }),
  );

  app.use(errorHandler);

  return app;
};
