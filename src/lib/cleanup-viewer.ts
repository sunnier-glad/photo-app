import { getNextPhotoAfterDelete } from './photo-navigation';

export const getNextDeletedPhotoAfterAction = (
  photoIds: string[],
  currentPhotoId: string,
) => getNextPhotoAfterDelete(photoIds, currentPhotoId);
