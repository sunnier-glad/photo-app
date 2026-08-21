type SharedPhotoOwner = {
  sharedById: string;
};

export const SHARED_SPACE_DELETE_OWN_MESSAGE = '只能删除自己上传到共享相册的照片/视频';

export const canDeleteSharedSpacePhoto = (
  photo: SharedPhotoOwner,
  currentUserId: string,
) => photo.sharedById === currentUserId;
