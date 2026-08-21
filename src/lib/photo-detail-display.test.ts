import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Photo } from '../types';
import { getPhotoDetailMeta, getPhotoDetailTitle } from './photo-detail-display';

const basePhoto: Photo = {
  id: 'photo_1',
  url: 'https://example.com/photo.jpg',
  title: '1780547590500.jpg',
  dateAdded: '2026-06-04',
};

test('uses saved AI title before raw file name', () => {
  assert.equal(
    getPhotoDetailTitle({ ...basePhoto, aiTitle: '火锅里的第 200 天' }, '200天纪念日'),
    '火锅里的第 200 天',
  );
});

test('hides raw image file names and falls back to album title', () => {
  assert.equal(getPhotoDetailTitle(basePhoto, '200天纪念日'), '200天纪念日的回忆');
});

test('keeps a friendly manual photo title', () => {
  assert.equal(getPhotoDetailTitle({ ...basePhoto, title: '生日晚餐' }, '家庭时光'), '生日晚餐');
});

test('builds friendly metadata without memory id', () => {
  assert.deepEqual(
    getPhotoDetailMeta({
      ...basePhoto,
      location: '未标记地点',
      uploadedByName: '测试用户',
    }),
    ['未标记地点', '2026-06-04', '测试用户 上传'],
  );
});
