import { app, BrowserWindow, Menu, session, shell, type MenuItemConstructorOptions } from 'electron'

export let DEEPSEEK_首页地址 = 'https://chat.deepseek.com/a/chat/'
export let DEEPSEEK_会话分区 = 'persist:deepseek'
export let 标准ChromeUA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'

let 允许内嵌域名后缀组 = [
  'deepseek.com',
  'accounts.google.com',
  'github.com',
  'open.weixin.qq.com',
  'appleid.apple.com',
]

function 提取主机名(目标地址: string): string | null {
  try {
    let 解析结果 = new URL(目标地址)
    return 解析结果.hostname.toLowerCase()
  } catch {
    return null
  }
}

export function 是否允许应用内打开(目标地址: string): boolean {
  let 主机名 = 提取主机名(目标地址)
  if (主机名 === null) return false

  for (let 后缀 of 允许内嵌域名后缀组) {
    if (主机名 === 后缀 || 主机名.endsWith(`.${后缀}`)) {
      return true
    }
  }
  return false
}

export function 是否为安全外链协议(目标地址: string): boolean {
  try {
    let 解析结果 = new URL(目标地址)
    return 解析结果.protocol === 'https:' || 解析结果.protocol === 'http:'
  } catch {
    return false
  }
}

export function 净化UserAgent(原始UA: string): string {
  return 原始UA
    .replace(/\sElectron\/[^\s]+/g, '')
    .replace(/\s@?lsby\/[^\s]+/g, '')
    .replace(/\sdeepseek-desktop\/[^\s]+/g, '')
    .replace(/\sDeepSeek\sDesktop\/[^\s]+/g, '')
}

export function 配置DeepSeek会话(): void {
  let 深求会话 = session.fromPartition(DEEPSEEK_会话分区)
  app.userAgentFallback = 标准ChromeUA
  深求会话.setUserAgent(标准ChromeUA, 'zh-CN,zh;q=0.9,en;q=0.8')
  深求会话.webRequest.onBeforeSendHeaders((详情, 回调) => {
    详情.requestHeaders['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8'
    详情.requestHeaders['sec-ch-ua-platform'] = '"Windows"'
    回调({ requestHeaders: 详情.requestHeaders })
  })
}

export function 配置DeepSeek窗口行为(窗口: BrowserWindow): void {
  窗口.webContents.setUserAgent(标准ChromeUA)

  窗口.webContents.setWindowOpenHandler(({ url }) => {
    if (是否允许应用内打开(url) === true) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 960,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            partition: DEEPSEEK_会话分区,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      }
    }

    if (是否为安全外链协议(url) === true) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  窗口.webContents.on('will-navigate', (事件, 目标地址) => {
    if (是否允许应用内打开(目标地址) === true) {
      return
    }
    事件.preventDefault()
    if (是否为安全外链协议(目标地址) === true) {
      void shell.openExternal(目标地址)
    }
  })

  窗口.webContents.on('did-fail-load', (_事件, 错误码, 错误描述, 失败地址, 是否为主框架) => {
    if (是否为主框架 === false || 错误码 === -3) {
      return
    }
    let 编码地址 = JSON.stringify(失败地址)
    let 编码错误 = JSON.stringify(`${错误描述} (${错误码})`)
    let 兜底页面 = [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head><meta charset="utf-8"><title>DeepSeek 连接失败</title>',
      '<style>',
      'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1115;color:#e5e7eb;}',
      '.card{max-width:420px;padding:28px;border-radius:14px;background:#181b22;border:1px solid #2a2f3a;text-align:center;}',
      'h1{margin:0 0 10px;font-size:18px;}',
      'p{margin:0 0 18px;font-size:13px;color:#9ca3af;word-break:break-all;}',
      'button{padding:9px 18px;border-radius:8px;border:none;background:#4d6bfe;color:#fff;font-size:14px;cursor:pointer;}',
      'button:hover{background:#3b58e8;}',
      '</style></head>',
      '<body><div class="card">',
      '<h1>无法连接到 DeepSeek</h1>',
      `<p id="msg"></p>`,
      '<button id="retry">重新加载</button>',
      '<script>',
      `document.getElementById("msg").textContent = ${编码错误} + " - " + ${编码地址};`,
      `document.getElementById("retry").onclick = function(){ location.href = ${JSON.stringify(DEEPSEEK_首页地址)}; };`,
      '</script>',
      '</div></body></html>',
    ].join('')
    void 窗口.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(兜底页面)}`)
  })
}

export function 安装应用菜单(获取主窗口: () => BrowserWindow | null): void {
  let 模板: MenuItemConstructorOptions[] = []

  if (process.platform === 'darwin') {
    模板.push({
      label: 'DeepSeek',
      submenu: [
        { role: 'about', label: '关于 DeepSeek Desktop' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏窗口' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出 DeepSeek Desktop' },
      ],
    })
  }

  模板.push(
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '回到 DeepSeek 首页',
          accelerator: 'CmdOrCtrl+Shift+H',
          click: (): void => {
            let 窗口 = 获取主窗口()
            if (窗口 !== null) void 窗口.loadURL(DEEPSEEK_首页地址)
          },
        },
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        {
          label: '窗口置顶',
          type: 'checkbox',
          checked: false,
          accelerator: 'CmdOrCtrl+Shift+T',
          click: (菜单项): void => {
            let 窗口 = 获取主窗口()
            if (窗口 !== null) 窗口.setAlwaysOnTop(菜单项.checked)
          },
        },
        { role: 'togglefullscreen', label: '切换全屏' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
  )

  let 菜单 = Menu.buildFromTemplate(模板)
  Menu.setApplicationMenu(菜单)
}
