import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canDeleteSharedSpacePhoto,
  SHARED_SPACE_DELETE_OWN_MESSAGE,
} from './shared-space-permissions';

test('canDeleteSharedSpacePhoto returns true only for the uploader', () => {
  assert.equal(
    canDeleteSharedSpacePhoto({ sharedById: 'user-1' }, 'user-1'),
    true,
  );
  assert.equal(
    canDeleteSharedSpacePhoto({ sharedById: 'user-2' }, 'user-1'),
    false,
  );
});

test('shared space delete permission message stays consistent', () => {
  assert.equal(
    SHARED_SPACE_DELETE_OWN_MESSAGE,
    '只能删除自己上传到共享相册的照片/视频',
  );
});
