# Deeper AgentTeam

一个功能完备的 Chrome 插件，用于在 DeepSeek 中创建和管理多角色 AI 团队。

## 作者信息

- **作者**: 最中幻想
- **微信**: andyloveanny
- **邮箱**: sifangzhiji@qq.com

## 功能特性

### 团队管理
- **创建团队**: 设置团队名称、简介、通用提示词、辅助提示词
- **团队设置**: 
  - 自动发送间隔（控制消息发送频率）
  - 清理频率（自动清理历史记录）
  - 深度思考开关
  - 联网搜索开关
  - 独立角色记忆开关
  - 群体记忆开关

### 成员管理
- **添加成员**: 为每个成员配置：
  - 名称和身份标识
  - 角色类型（团队经理、程序员、美工、策划等）
  - 所属上级（建立层级关系）
  - 工作流程描述
  - 专属提示词
- **层级结构**: 支持 parent-child 关系，构建团队协作层级

### 消息系统
- **群聊（广播）**: 向全体成员群发消息，支持设置发送间隔
- **私聊**: 单独与某个成员对话
- **自动标签页**: 首次向成员发送消息时，自动创建独立的 DeepSeek 标签页

### 自动化工作流
- **消息发送**: 自动填充提示词并发送到 DeepSeek
- **回复监控**: 实时监控成员回复内容
- **JSON 指令解析**: 识别角色回复末尾的 JSON 命令
  - 格式: `{"action": "send", "target": "member_id或all", "message": "内容"}`
  - 支持动作: send（发送消息）、switch（切换标签页）
- **自动标签页切换**: 根据 JSON 指令自动切换到对应成员标签页
- **自动消息路由**: 根据指令自动转发消息给目标成员

### 进度追踪
- 实时监控团队成员状态（空闲、发送中、等待回复、已完成、错误）
- 可视化进度展示
- 支持中断和重置任务

### 日志系统
- 完整的操作日志记录
- 支持日志级别筛选

## 安装方法

1. 下载本插件源码到本地文件夹
2. 打开 Chrome 扩展管理页面（`chrome://extensions/`）
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"，选择插件所在的文件夹
5. 插件安装完成

## 使用流程

### 1. 创建团队
1. 点击浏览器工具栏的插件图标
2. 点击"新建团队"或在选项页面创建
3. 设置团队名称和详细配置
4. 配置团队设置（发送间隔、清理频率、功能开关等）

### 2. 添加成员
1. 进入团队详情页面
2. 点击"添加成员"
3. 填写成员信息：
   - 名称和身份标识
   - 选择角色类型
   - 设置所属上级（可选）
   - 描述工作流程
   - 编写专属提示词

### 3. 开始协作
1. 在团队聊天界面选择群聊或私聊
2. 输入任务描述并发送
3. 插件会自动：
   - 为每个成员创建 DeepSeek 标签页
   - 发送配置好的提示词
   - 监控回复内容
   - 解析 JSON 指令
   - 自动切换标签页并转发消息

### 4. JSON 指令格式
成员可以在回复末尾包含 JSON 指令来控制插件行为：

```json
{
  "action": "send",
  "target": "member_id",
  "message": "要发送的消息内容"
}
```

或广播给所有成员：

```json
{
  "action": "send",
  "target": "all",
  "message": "广播消息"
}
```

切换标签页：

```json
{
  "action": "switch",
  "target": "member_id"
}
```

## 赞助支持

如果觉得本插件对您有帮助，欢迎赞助支持！

**请作者喝一杯咖啡吧，谢谢**

- 微信: andyloveanny
- 邮箱: sifangzhiji@qq.com

## 友情链接

- [GitHub](https://github.com)
- [MK48论坛](https://mk48by049.mbbs.cc)
- [Free论坛](https://china.free.mbbs.cc)
- [Kimi](https://kimi.com)
- [文叔叔](https://wenshushu.com)
- [文叔叔CN](https://wenshushu.cn)
- [AirPortal](https://airportal.cn)

## 文件结构

```
deeper-AgentTeam/
├── manifest.json          # 插件配置文件
├── README.md              # 说明文档
├── LICENSE                # 许可证
├── assets/
│   └── icon.png          # 插件图标
└── src/
    ├── background/
    │   └── worker.js     # Service Worker 后台脚本
    ├── content/
    │   ├── content.js    # 内容脚本（与DeepSeek页面交互）
    │   ├── panel.js      # 团队面板逻辑
    │   └── panel.css     # 面板样式
    └── ui/
        ├── options.html  # 选项页面
        ├── options.js    # 选项页面脚本
        ├── popup.html    # 弹出窗口
        └── popup.js      # 弹出窗口脚本
```

## 技术架构

- **Manifest V3**: 使用 Chrome Extension Manifest V3 标准
- **Service Worker**: 后台脚本处理团队管理和消息路由
- **Content Scripts**: 注入 DeepSeek 页面实现自动化操作
- **IndexedDB**: 本地数据持久化存储
- **Message Passing**: 组件间通信机制

## 许可证

MIT License

Copyright (c) 2026 最中幻想
