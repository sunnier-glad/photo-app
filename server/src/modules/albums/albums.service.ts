import { HttpError } from '../../common/http-error.js';

export type AlbumRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AlbumPhotoRecord = {
  id: string;
  albumId: string;
  uploadedById: string;
  title: string | null;
  aiTitle?: string | null;
  location: string | null;
  objectKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AlbumWithPhotosRecord = AlbumRecord & {
  photos: AlbumPhotoRecord[];
};

export type CreateAlbumInput = {
  title: string;
  description?: string;
};

export type AlbumsRepository = {
  listByOwner(ownerId: string): Promise<AlbumRecord[]>;
  listWithPhotosByOwner(ownerId: string): Promise<AlbumWithPhotosRecord[]>;
  findByIdForOwner(albumId: string, ownerId: string): Promise<AlbumRecord | null>;
  listPhotos(albumId: string): Promise<AlbumPhotoRecord[]>;
  create(input: {
    ownerId: string;
    title: string;
    description: string | null;
  }): Promise<AlbumRecord>;
};

export const createAlbumsService = (albumsRepository: AlbumsRepository) => ({
  listAlbums(userId: string) {
    return albumsRepository.listByOwner(userId);
  },

  listAlbumsWithPhotos(userId: string) {
    return albumsRepository.listWithPhotosByOwner(userId);
  },

  async listAlbumPhotos(userId: string, albumId: string) {
    const album = await albumsRepository.findByIdForOwner(albumId, userId);

    if (!album) {
      throw new HttpError(404, 'ALBUM_NOT_FOUND', 'Album not found');
    }

    return albumsRepository.listPhotos(album.id);
  },

  async createAlbum(userId: string, input: CreateAlbumInput) {
    const title = input.title.trim();

    if (!title) {
      throw new HttpError(400, 'INVALID_ALBUM_TITLE', 'Album title is required');
    }

    const description = input.description?.trim();

    return albumsRepository.create({
      ownerId: userId,
      title,
      description: description ? description : null,
    });
  },
});

export type AlbumsService = ReturnType<typeof createAlbumsService>;
