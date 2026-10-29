// 關西國小 115 學年度上學期課後社團資料
// 來源：新竹縣關西國民小學 115 學年度上學期課後社團活動統整表
// 新增社團：在 CLUBS 陣列加一筆，category 填 CATEGORIES 的 id 即可，島上會自動長出小屋。
// days：1=週一 … 5=週五；time：["HH:MM","HH:MM"]

export const SCHOOL = {
  name: '關西國小',
  fullName: '新竹縣關西鎮關西國民小學',
  title: '關西國小社團群島',
  term: '115 學年度上學期',
  lat: 24.7887,
  lon: 121.1757,
  place: '新竹關西',
  // 社團報名系統（Google Apps Script，需用學校 Google 帳號登入）
  signupUrl: 'https://script.google.com/a/macros/gses.hcc.edu.tw/s/AKfycbxH9iGCDrmlHvAClAuZx3csw5FOa6Qp1M1RrCRp4QE6dWOCNuYIQbuTA8Gp9MNuhUo_Mw/exec',
};

// 6 大類＝6 座浮空島
export const CATEGORIES = [
  { id: 'ball',  name: '球類運動島', short: '球類', emoji: '🏸', color: '#7bc47f', roof: '#e8734a', desc: '揮拍、運球、投籃，在雲端球場揮灑汗水！' },
  { id: 'wheel', name: '輪滑體能島', short: '輪滑', emoji: '🛼', color: '#8fd3e8', roof: '#3d7fc4', desc: '繞著雲朵溜冰道滑行，練出平衡與速度。' },
  { id: 'bake',  name: '美味烘焙島', short: '烘焙', emoji: '🧁', color: '#f2c98a', roof: '#d2694f', desc: '煙囪飄出奶油香，親手做出甜蜜點心。' },
  { id: 'art',   name: '藝術手作島', short: '手作', emoji: '🎨', color: '#e9a8c8', roof: '#8a5cc4', desc: '黏土、UV 膠、花藝，把想像捏成作品。' },
  { id: 'dance', name: '舞動表演島', short: '舞蹈', emoji: '💃', color: '#c7b3f0', roof: '#e0559a', desc: '站上雲端舞台，跟著節奏自信展現自己。' },
  { id: 'tech',  name: '科學創客島', short: '科技', emoji: '🤖', color: '#a9d98b', roof: '#e0a030', desc: '齒輪、結構、彈力車，動手打造會動的機器。' },
];

export const CLUBS = [
  { no: 1,  name: '羽球 A',        category: 'ball',  days: [2], time: ['16:00', '17:00'], teacher: '謝文忠', content: '羽球初階、進階技巧', min: 8, max: 18, sessions: 14, fee: 2200, grade: [2, 6] },
  { no: 2,  name: '羽球 B',        category: 'ball',  days: [4], time: ['16:00', '17:00'], teacher: '謝文忠', content: '羽球初階、進階技巧', min: 8, max: 18, sessions: 14, fee: 2200, grade: [2, 6] },
  { no: 3,  name: '直排輪 A',      category: 'wheel', days: [2], time: ['15:50', '16:50'], teacher: '邱志銘', content: '直排輪入門／直排輪進階／直排輪曲棍球', min: 6, max: 20, sessions: 13, fee: 2100, grade: [1, 6] },
  { no: 4,  name: '直排輪 B',      category: 'wheel', days: [5], time: ['12:50', '14:20'], teacher: '邱志銘', content: '直排輪入門／直排輪進階／直排輪曲棍球', min: 6, max: 20, sessions: 11, fee: 2000, grade: [1, 4] },
  { no: 5,  name: '泰迪籃球',      category: 'ball',  days: [1], time: ['16:00', '17:00'], teacher: '洪楷勛', content: '籃球初階、進階技巧', min: 4, max: 18, sessions: 12, fee: 1800, grade: [1, 6] },
  { no: 6,  name: 'kiki 創意烘焙',  category: 'bake',  days: [2], time: ['15:50', '17:00'], teacher: '戴湘如', content: '葡式蛋塔、萬聖搞怪木乃伊餅乾、蜜蘋乳酪蛋糕、柚香戚風蛋糕、香甜奶酥麵包、幻紫雪球、茉莉香片葉子餅乾⋯等', min: 6, max: 12, sessions: 10, fee: 3300, grade: [1, 6] },
  { no: 7,  name: 'Sc 玩在藝起',    category: 'art',   days: [3], time: ['15:30', '17:00'], teacher: '呂采芩', content: '結合時下流行藝術（UV 膠、花藝、多媒材），作品：蠟燭壽司、香氛儲物罐、泡泡世界、觀葉植物、色塊畫⋯等', min: 5, max: 15, sessions: 15, fee: 5000, grade: [1, 6] },
  { no: 8,  name: '木颯黏土捏塑',  category: 'art',   days: [3], time: ['13:00', '14:30'], teacher: '彭艷玲', content: '黏土材料與製作解說，作品：火鍋料理、卡皮巴拉的家、小白兔與蘿蔔田、卡通角色大集合⋯等', min: 6, max: 24, sessions: 15, fee: 3950, grade: [1, 6] },
  { no: 9,  name: 'MOSA MV 流行舞', category: 'dance', days: [3], time: ['13:00', '14:30'], teacher: '呂昊玟', content: '暖身、基本律動、流行舞蹈教學、自我呈現、緩和', min: 6, max: 24, sessions: 15, fee: 3600, grade: [1, 6] },
  { no: 10, name: '樂高動力機器人', category: 'tech',  days: [1], time: ['15:50', '17:00'], teacher: '李嘉凰', content: '伸縮器－柔性結構、自拍棒－剛性結構、摺疊車－結構應用、鋸子－往復運動、彈力車－橡皮筋運用⋯等', min: 8, max: 20, sessions: 10, fee: 3999, grade: [1, 6] },
];

export const QUOTES = [
  '有興趣，就是最好的老師。',
  '每天進步一點點，就是了不起。',
  '勇敢嘗試，失敗也是一種收穫。',
  '一起玩，一起學，一起長大。',
  '用雙手創造，用笑容分享。',
  '持之以恆，雲端也能抵達。',
  '好奇心是打開世界的鑰匙。',
];
