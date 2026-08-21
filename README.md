# 照片应用

照片应用是一款移动端优先的照片和视频管理工具，支持个人相册、爱心收藏、最近删除、共享空间、好友消息和 Android 客户端。本仓库包含 React 前端、Express API、Prisma 数据模型、自动化测试以及 Capacitor Android 工程。

## 主要功能

- 管理个人相册，支持上传照片和视频、爱心收藏、本地媒体缓存以及左右滑动查看。
- 提供清理与最近删除功能，支持批量选择、恢复、彻底删除和全屏查看。
- 提供共享空间，成员可以上传媒体，并且只能删除自己上传的内容。
- 支持邮箱注册、JWT 身份验证、个人资料、个人 ID、好友申请和好友消息。
- 支持阿里云 OSS 直传，由服务端生成上传凭证和签名读取地址。
- 可选接入 MiMo 生成照片标题，并支持 Android 应用内版本更新清单。

## 技术栈

- 前端：React 19、TypeScript、Vite 6、Tailwind CSS 4、Motion、Lucide React。
- 后端：Express、Prisma、MySQL、JWT、Zod、Nodemailer。
- 存储：阿里云 OSS，服务端签名并结合客户端媒体缓存。
- 移动端：Capacitor 6 和 Android Gradle 工具链。
- 测试：通过 `tsx` 使用 Node.js 测试运行器，并执行 TypeScript 类型检查。

## 项目结构

```text
src/                         React 应用、Hooks、工具函数和前端测试
server/src/                  Express API 和业务模块
server/tests/                后端单元测试与集成测试
server/prisma/schema.prisma  MySQL 数据模型
android/                     Capacitor Android 应用工程
assets/                      应用图标等源素材
release/memories/            公开版本更新清单示例
```

## 环境要求

- Node.js 20 或更高版本，以及 npm。
- MySQL 8 或兼容的 MySQL 数据库。
- 阿里云 OSS Bucket 和访问凭证，用于照片与视频上传。
- 如需发送真实邮箱验证码，需要配置 SMTP 凭证。
- 如需构建 Android APK，需要 JDK 17、Android SDK 和兼容的 Gradle 环境。

## 环境配置

安装锁定版本的依赖，并创建本地环境变量文件：

```powershell
npm ci
Copy-Item .env.example .env
```

根据实际环境修改 `.env` 中的数据库、JWT、OSS 以及可选的 SMTP、MiMo 配置。不要提交 `.env` 文件。OSS 访问密钥只能由后端使用，禁止放入任何 `VITE_*` 环境变量。

## 数据库配置

创建开发数据库：

```sql
CREATE DATABASE memories CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

生成 Prisma Client 并应用数据库结构：

```powershell
npm run prisma:generate
npm run prisma:migrate -- --name init_memories_backend
```

需要查看和编辑开发数据时，可以运行 `npm run prisma:studio`。

## 本地开发

启动后端 API 服务：

```powershell
npm run dev:server
```

在另一个终端启动前端：

```powershell
npm run dev
```

前端默认请求 `http://localhost:4000/api`，Vite 默认使用 `3000` 端口提供页面。

## 测试与验证

```powershell
npm run prisma:generate
npm run test:frontend
npm run test:server
npm run lint
npm run build
```

## Android 构建

构建并同步 Web 应用，然后生成调试版 APK：

```powershell
npm run apk:debug
```

生成的 APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`，该文件已被 Git 忽略。如果真机需要访问开发环境 API，请在构建前将 `VITE_API_BASE_URL` 设置为手机能够访问的开发服务器地址。

## 运行时配置

- `VITE_API_BASE_URL`：前端 API 地址，默认值为 `http://localhost:4000/api`。
- `VITE_UPDATE_MANIFEST_URL`：Android 更新清单地址，默认使用 `example.com` 占位地址。
- `DATABASE_URL`、`JWT_SECRET`、`OSS_*`、`SMTP_*`：后端数据库、身份验证、对象存储和邮件配置。
- `MIMO_API_KEY`、`MIMO_BASE_URL`、`MIMO_MODEL`：可选的照片标题助手配置。
- `release/memories/version.json`：版本更新清单示例，部署时需要替换其中的 APK 占位地址。

## 安全说明

- 禁止将 `.env`、访问凭证、签名密钥、APK 和构建产物提交到版本库。
- OSS 凭证应遵循最小权限原则；如果凭证可能泄露，请立即轮换。
- 公开默认配置仅使用 `localhost` 和 `example.com`，部署地址应通过环境变量设置。
- 当前 Android 调试配置允许明文 HTTP，便于本地开发；生产版本应使用 HTTPS，并将 `android:usesCleartextTraffic` 设置为 `false`。
- 部署前请检查依赖安全审计结果，并在充分测试后再应用可能包含破坏性变更的安全升级。

## 开源许可证

本项目采用 Apache License 2.0，完整内容请查看 `LICENSE`。
