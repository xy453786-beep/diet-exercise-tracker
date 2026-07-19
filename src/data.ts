import { MealRecord, WorkoutItem, WeightEntry, AIDietAnalysis } from './types';

export const INITIAL_WEIGHTS: WeightEntry[] = [
  { day: '周一', weight: 73.5 },
  { day: '周二', weight: 73.2 },
  { day: '周三', weight: 73.4 },
  { day: '周四', weight: 72.8 },
  { day: '周五', weight: 72.5 },
  { day: '周六', weight: 72.7 },
  { day: '今日', weight: 72.5, isToday: true }
];

export const INITIAL_MEALS: MealRecord[] = [
  {
    category: 'breakfast',
    name: '早餐',
    icon: '🌅',
    items: [
      {
        id: 'b1',
        name: '全麦面包配牛油果',
        calories: 280,
        protein: 12,
        carbs: 35,
        fat: 10,
        portion: '1份 (120g)',
        image: 'https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=120&auto=format&fit=crop&q=60'
      },
      {
        id: 'b2',
        name: '黑咖啡',
        calories: 60,
        protein: 1,
        carbs: 5,
        fat: 0,
        portion: '1杯 (250ml)',
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=120&auto=format&fit=crop&q=60'
      }
    ]
  },
  {
    category: 'lunch',
    name: '午餐',
    icon: '☀️',
    items: [
      {
        id: 'l1',
        name: '香煎三文鱼配藜麦',
        calories: 680,
        protein: 38,
        carbs: 55,
        fat: 28,
        portion: '1份 (350g)',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=120&auto=format&fit=crop&q=60'
      }
    ]
  },
  {
    category: 'dinner',
    name: '晚餐',
    icon: '🌙',
    items: [
      {
        id: 'd1',
        name: '蔬菜清鸡汤',
        calories: 400,
        protein: 34,
        carbs: 25,
        fat: 15,
        portion: '1份 (300g)',
        image: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=120&auto=format&fit=crop&q=60'
      }
    ]
  }
];

export const INITIAL_MEALS_BY_DAY: Record<string, MealRecord[]> = {
  '周一': [
    {
      category: 'breakfast',
      name: '早餐',
      icon: '🌅',
      items: [
        { id: 'm1_1', name: '蓝莓燕麦粥', calories: 210, protein: 8, carbs: 42, fat: 3, portion: '1碗' }
      ]
    },
    {
      category: 'lunch',
      name: '午餐',
      icon: '☀️',
      items: [
        { id: 'm1_2', name: '香煎鸡胸肉配西兰花', calories: 420, protein: 35, carbs: 12, fat: 8, portion: '1份' }
      ]
    },
    {
      category: 'dinner',
      name: '晚餐',
      icon: '🌙',
      items: [
        { id: 'm1_3', name: '蔬菜豆腐汤', calories: 150, protein: 10, carbs: 15, fat: 5, portion: '1碗' }
      ]
    }
  ],
  '周二': [
    {
      category: 'breakfast',
      name: '早餐',
      icon: '🌅',
      items: [
        { id: 'm2_1', name: '牛油果吐司', calories: 290, protein: 7, carbs: 35, fat: 12, portion: '1片' }
      ]
    },
    {
      category: 'lunch',
      name: '午餐',
      icon: '☀️',
      items: [
        { id: 'm2_2', name: '黑椒牛肉意面', calories: 580, protein: 28, carbs: 70, fat: 14, portion: '1盘' }
      ]
    },
    {
      category: 'dinner',
      name: '晚餐',
      icon: '🌙',
      items: [
        { id: 'm2_3', name: '虾仁蒸蛋', calories: 180, protein: 16, carbs: 4, fat: 8, portion: '1碗' }
      ]
    }
  ],
  '周三': [
    {
      category: 'breakfast',
      name: '早餐',
      icon: '🌅',
      items: [
        { id: 'm3_1', name: '低脂希腊酸奶杯', calories: 160, protein: 15, carbs: 12, fat: 2, portion: '1杯' }
      ]
    },
    {
      category: 'lunch',
      name: '午餐',
      icon: '☀️',
      items: [
        { id: 'm3_2', name: '金枪鱼沙拉三明治', calories: 460, protein: 24, carbs: 48, fat: 10, portion: '1个' }
      ]
    },
    {
      category: 'dinner',
      name: '晚餐',
      icon: '🌙',
      items: [
        { id: 'm3_3', name: '清蒸鳕鱼配冬瓜', calories: 220, protein: 22, carbs: 8, fat: 4, portion: '1盘' }
      ]
    }
  ],
  '周四': [
    {
      category: 'breakfast',
      name: '早餐',
      icon: '🌅',
      items: [
        { id: 'm4_1', name: '蒸红薯配无糖豆浆', calories: 240, protein: 9, carbs: 45, fat: 3, portion: '1套' }
      ]
    },
    {
      category: 'lunch',
      name: '午餐',
      icon: '☀️',
      items: [
        { id: 'm4_2', name: '卤肉饭 (少油)', calories: 650, protein: 22, carbs: 80, fat: 18, portion: '1碗' }
      ]
    },
    {
      category: 'dinner',
      name: '晚餐',
      icon: '🌙',
      items: [
        { id: 'm4_3', name: '鸡丝凉面', calories: 380, protein: 18, carbs: 50, fat: 8, portion: '1盘' }
      ]
    }
  ],
  '周五': [
    {
      category: 'breakfast',
      name: '早餐',
      icon: '🌅',
      items: [
        { id: 'm5_1', name: '水煮蛋2个 + 香蕉', calories: 250, protein: 13, carbs: 30, fat: 10, portion: '1份' }
      ]
    },
    {
      category: 'lunch',
      name: '午餐',
      icon: '☀️',
      items: [
        { id: 'm5_2', name: '韩式石锅拌饭', calories: 590, protein: 20, carbs: 85, fat: 12, portion: '1碗' }
      ]
    },
    {
      category: 'dinner',
      name: '晚餐',
      icon: '🌙',
      items: [
        { id: 'm5_3', name: '蔬菜煎豆腐', calories: 190, protein: 12, carbs: 10, fat: 11, portion: '1盘' }
      ]
    }
  ],
  '周六': [
    {
      category: 'breakfast',
      name: '早餐',
      icon: '🌅',
      items: [
        { id: 'm6_1', name: '全麦华夫饼配蜂蜜', calories: 320, protein: 8, carbs: 55, fat: 6, portion: '2片' }
      ]
    },
    {
      category: 'lunch',
      name: '午餐',
      icon: '☀️',
      items: [
        { id: 'm6_2', name: '烤肉披萨2片', calories: 680, protein: 26, carbs: 75, fat: 22, portion: '2片' }
      ]
    },
    {
      category: 'dinner',
      name: '晚餐',
      icon: '🌙',
      items: [
        { id: 'm6_3', name: '无糖酸奶 + 坚果', calories: 180, protein: 8, carbs: 10, fat: 12, portion: '1杯' }
      ]
    }
  ],
  '今日': INITIAL_MEALS
};

export const INITIAL_WORKOUTS: WorkoutItem[] = [
  {
    id: 'w1',
    type: '户外跑步',
    duration: '32\'15"',
    calories: 320,
    intensity: 'medium-high',
    category: 'aerobic',
    time: '今天 07:30',
    distance: '5.2 公里'
  },
  {
    id: 'w2',
    type: '力量训练',
    duration: '45\'00"',
    calories: 182,
    intensity: 'high',
    category: 'resistance',
    time: '昨天 18:45',
    distance: '全身'
  },
  {
    id: 'w3',
    type: '自由泳',
    duration: '28\'40"',
    calories: 240,
    intensity: 'medium',
    category: 'aerobic',
    time: '10月22日',
    distance: '1000 米'
  }
];

export const INITIAL_WORKOUTS_BY_DAY: Record<string, WorkoutItem[]> = {
  '周一': [
    { id: 'w_m1', type: '慢跑', duration: '30\'00"', calories: 280, intensity: 'medium', category: 'aerobic', time: '周一 08:00', distance: '4.5 公里' }
  ],
  '周二': [
    { id: 'w_tu1', type: '动感单车', duration: '40\'00"', calories: 350, intensity: 'high', category: 'aerobic', time: '周二 19:00', distance: '12 公里' }
  ],
  '周三': [
    { id: 'w_we1', type: '哑铃胸肌训练', duration: '45\'00"', calories: 180, intensity: 'medium', category: 'resistance', time: '周三 18:30', distance: '胸部' }
  ],
  '周四': [
    { id: 'w_th1', type: '瑜伽拉伸', duration: '30\'00"', calories: 120, intensity: 'low', category: 'aerobic', time: '周四 07:00' }
  ],
  '周五': [
    { id: 'w_fr1', type: '游泳', duration: '45\'00"', calories: 380, intensity: 'high', category: 'aerobic', time: '周五 12:15', distance: '1500 米' }
  ],
  '周六': [
    { id: 'w_sa1', type: '力量训练 (腿部)', duration: '50\'00"', calories: 240, intensity: 'high', category: 'resistance', time: '周六 15:30', distance: '腿部' }
  ],
  '今日': [
    {
      id: 'w1',
      type: '户外跑步',
      duration: '32\'15"',
      calories: 320,
      intensity: 'medium-high',
      category: 'aerobic',
      time: '今天 07:30',
      distance: '5.2 公里'
    }
  ]
};

export const MOCK_AI_DIET_ANALYSIS: AIDietAnalysis = {
  name: '香煎三文鱼藜麦碗',
  calories: 542,
  protein: { amount: 32, percentage: 35 },
  carbs: { amount: 45, percentage: 40 },
  fat: { amount: 18, percentage: 25 },
  suggestions: {
    optimization: '这餐含有优质蛋白，但钠含量略高。建议下一餐增加绿叶蔬菜摄入，平衡电解质。',
    exercise: '这餐非常适合作为抗阻训练后的补充。建议在两小时内进行 30 分钟中强度力量训练。'
  },
  ingredients: [
    { name: '烤三文鱼 (150g)', portion: '150g', calories: 312 },
    { name: '三色藜麦 (100g)', portion: '100g', calories: 120 },
    { name: '新鲜牛油果 (50g)', portion: '50g', calories: 80 },
    { name: '其他配料 (混合蔬菜、酱汁)', portion: '混合', calories: 30 }
  ],
  image: '/src/assets/images/salmon_quinoa_bowl_1784184590278.jpg'
};
