/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Album, Contact, DeletedPhoto, SharedSpace, UserProfile } from './types';

export const initialUserProfile: UserProfile = {
  name: '相册体验用户',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&q=80&fit=crop',
  curatorSince: '2021 年 10 月',
  memoriesCount: '2.4k',
  collectionsCount: '42',
  storageUsedGB: 12.4,
  storageTotalGB: 50,
  privateAlbumsOnly: false,
  activityStatusActive: true,
  locationTaggingActive: true,
};

export const initialAlbums: Album[] = [
  {
    id: 'alb-1',
    title: '2023 夏日海岸',
    coverUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    tags: ['旅行', '夏天', '海边'],
    type: 'all',
    photos: [
      { id: 'p-101', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', title: '蓝绿色浪花', dateAdded: '2023-07-15', location: '意大利 阿马尔菲海岸' },
      { id: 'p-102', url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80', title: '金色海岸线', dateAdded: '2023-07-18', location: '意大利 波西塔诺' },
      { id: 'p-103', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80', title: '独处吊床', dateAdded: '2023-07-20', location: '意大利 卡普里' },
      { id: 'p-104', url: 'https://images.unsplash.com/photo-1473116763269-255ea7604bb6?w=800&q=80', title: '深海蓝调', dateAdded: '2023-07-22', location: '意大利 撒丁岛' },
    ],
  },
  {
    id: 'alb-2',
    title: '婚礼那天',
    coverUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
    tags: ['庆祝', '家人'],
    type: 'recent',
    photos: [
      { id: 'p-201', url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80', title: '烛光杯影', dateAdded: '2023-09-10', location: '意大利 托斯卡纳' },
      { id: 'p-202', url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&q=80', title: '鲜花拱门', dateAdded: '2023-09-10', location: '意大利 托斯卡纳' },
      { id: 'p-203', url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80', title: '新娘手捧花', dateAdded: '2023-09-10', location: '意大利 托斯卡纳' },
    ],
  },
  {
    id: 'alb-3',
    title: '阿尔卑斯山',
    coverUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80',
    tags: ['徒步', '自然'],
    type: 'all',
    photos: [
      { id: 'p-301', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', title: '山脊远眺', dateAdded: '2023-08-22', location: '瑞士 采尔马特' },
      { id: 'p-302', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', title: '三峰并立', dateAdded: '2023-08-23', location: '瑞士 采尔马特' },
      { id: 'p-303', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', title: '绿谷晨雾', dateAdded: '2023-08-25', location: '瑞士 因特拉肯' },
    ],
  },
  {
    id: 'alb-4',
    title: '家人时光',
    coverUrl: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&q=80',
    tags: ['人像', '生活'],
    type: 'all',
    photos: [
      { id: 'p-401', url: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&q=80', title: '阳光野餐', dateAdded: '2021-10-05', location: '家中后院' },
      { id: 'p-402', url: 'https://images.unsplash.com/photo-1536640712-4d4c36ff0e4e?w=800&q=80', title: '傍晚笑声', dateAdded: '2022-04-12', location: '橡树岭公园' },
      { id: 'p-403', url: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80', title: '温柔拥抱', dateAdded: '2022-09-02', location: '温暖的家' },
    ],
  },
  {
    id: 'alb-5',
    title: '城市生活',
    coverUrl: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?w=800&q=80',
    tags: ['城市', '建筑'],
    type: 'shared',
    photos: [
      { id: 'p-501', url: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?w=800&q=80', title: '街角餐厅窗', dateAdded: '2023-01-14', location: '纽约 格林威治村' },
      { id: 'p-502', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80', title: '几何玻璃塔', dateAdded: '2023-01-20', location: '曼哈顿市中心' },
    ],
  },
  {
    id: 'alb-6',
    title: '巴黎旅行',
    coverUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
    tags: ['旅行', '城市'],
    type: 'all',
    photos: [
      { id: 'p-601', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80', title: '铁塔暮光', dateAdded: '2022-11-04', location: '法国 巴黎' },
      { id: 'p-602', url: 'https://images.unsplash.com/photo-1499856871958-5b9647a640db?w=800&q=80', title: '塞纳河散步', dateAdded: '2022-11-06', location: '法国 巴黎' },
      { id: 'p-603', url: 'https://images.unsplash.com/photo-1522083165195-3427502977a1?w=800&q=80', title: '温暖咖啡馆', dateAdded: '2022-11-07', location: '巴黎 蒙马特' },
    ],
  },
];

export const initialContacts: Contact[] = [
  {
    id: 'con-1',
    name: '朱利安',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&q=80&fit=crop',
    sharingCount: 3,
    isSharing: true,
    status: '正在共享 3 个相册',
  },
  {
    id: 'con-2',
    name: '克拉拉',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&q=80&fit=crop',
    sharingCount: 0,
    isSharing: false,
    status: '还没有共享内容',
  },
  {
    id: 'con-3',
    name: '马库斯',
    avatarUrl: '',
    initials: '马',
    sharingCount: 1,
    isSharing: true,
    status: '正在共享 1 个相册',
  },
  {
    id: 'con-4',
    name: '陈大卫',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&q=80&fit=crop',
    sharingCount: 12,
    isSharing: true,
    status: '正在共享 12 个相册',
  },
  {
    id: 'con-5',
    name: '叶琳娜',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&q=80&fit=crop',
    sharingCount: 4,
    isSharing: true,
    status: '推荐：来自通讯录',
    isSuggested: true,
    isFollowing: false,
  },
  {
    id: 'con-6',
    name: '凯勒布',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&q=80&fit=crop',
    sharingCount: 2,
    isSharing: true,
    status: '推荐：共同好友',
    isSuggested: true,
    isFollowing: false,
  },
];

export const initialDeletedPhotos: DeletedPhoto[] = [
  { id: 'del-1', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', title: '山谷旧照', daysLeft: 28, timeLeftUnit: 'days' },
  { id: 'del-2', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80', title: '雾中森林', daysLeft: 24, timeLeftUnit: 'days' },
  { id: 'del-3', url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&q=80', title: '露营回忆', daysLeft: 12, timeLeftUnit: 'days' },
  { id: 'del-4', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80', title: '森林旧片', daysLeft: 5, timeLeftUnit: 'days' },
  { id: 'del-5', url: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?w=800&q=80', title: '街角旧影', daysLeft: 2, timeLeftUnit: 'days' },
  { id: 'del-6', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80', title: '海滩暂删', daysLeft: 16, timeLeftUnit: 'hours' },
];

export const initialSharedSpaces: SharedSpace[] = [
  {
    id: 'space-1',
    title: '2023 夏日自驾',
    photosCount: 482,
    contributorsCount: 5,
    contributorsAvatars: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&q=80&fit=crop',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&q=80&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&q=80&fit=crop',
    ],
    coverUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
  },
  {
    id: 'space-2',
    title: '周末徒步',
    photosCount: 86,
    contributorsCount: 3,
    contributorsAvatars: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&q=80&fit=crop',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&q=80&fit=crop',
    ],
    coverUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
  },
  {
    id: 'space-3',
    title: '朋友晚餐会',
    photosCount: 124,
    contributorsCount: 8,
    contributorsAvatars: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&q=80&fit=crop',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&q=80&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&q=80&fit=crop',
    ],
    coverUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80',
  },
];

export const activeSpacePhotos = [
  { id: 'e-1', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80', title: '雪山之巅' },
  { id: 'e-2', url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&q=80', title: '晚宴餐桌' },
  { id: 'e-3', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80', title: '森林小径' },
  { id: 'e-4', url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', title: '营地篝火' },
];
