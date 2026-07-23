// SCF Web Function 入口
// 腾讯云函数会自动处理 HTTP，只需导出 Express app 实例

import { createApp } from './app';

const app = createApp();

// SCF Web Function 要求 export default 或 module.exports
export default app;
