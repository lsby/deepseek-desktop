import { app, BrowserWindow, screen } from 'electron'
import fs from 'fs'
import path from 'path'
import {
  DEEPSEEK_会话分区,
  DEEPSEEK_首页地址,
  安装应用菜单,
  标准ChromeUA,
  配置DeepSeek会话,
  配置DeepSeek窗口行为,
} from './electron/deepseek-shell'
import { 计算补偿后的窗口配置, 验证并修正窗口 } from './electron/multi-display'
import { 保存窗口状态, 检查窗口是否在可见区域内, 获取默认窗口位置, 读取窗口状态 } from './electron/window-state'

app.userAgentFallback = 标准ChromeUA
app.commandLine.appendSwitch('lang', 'zh-CN')

let 获得单实例锁 = app.requestSingleInstanceLock()
export let 主窗口: BrowserWindow | null = null

let 用户数据目录 =
  app.isPackaged === true
    ? process.platform === 'darwin'
      ? path.resolve(path.dirname(process.execPath), '../../../data')
      : path.resolve(path.dirname(process.execPath), '../data')
    : path.resolve('data')
fs.mkdirSync(用户数据目录, { recursive: true })
let 窗口状态路径 = path.join(用户数据目录, 'window-state.json')

/**
 * 创建主窗口
 *
 * 负责创建 DeepSeek 桌面壳主窗口，包括：
 * - 恢复窗口状态（位置、大小、最大化/全屏状态）
 * - 处理多显示器环境下的窗口位置和尺寸
 * - 配置持久化会话、外链跳转与菜单
 * - 直接加载 DeepSeek 网页端
 */
async function 创建主窗口(): Promise<void> {
  let 开发环境 = app.isPackaged === false
  let 所有显示器 = screen.getAllDisplays()
  let 保存的状态 = await 读取窗口状态(窗口状态路径)

  let 窗口配置: Electron.BrowserWindowConstructorOptions = {
    title: 'DeepSeek',
    show: false,
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      partition: DEEPSEEK_会话分区,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  }

  let 使用保存的位置 = false

  if (保存的状态 !== null) {
    let 位置有效 = 检查窗口是否在可见区域内({
      x: 保存的状态.x,
      y: 保存的状态.y,
      width: 保存的状态.width,
      height: 保存的状态.height,
    })

    if (位置有效 === true) {
      let 保存时的显示器 = 所有显示器.find((显示器) => 显示器.id === 保存的状态.displayId)

      if (保存时的显示器 !== undefined) {
        let 补偿后的配置 = 计算补偿后的窗口配置(保存的状态)
        窗口配置.x = 补偿后的配置.x
        窗口配置.y = 补偿后的配置.y
        窗口配置.width = 补偿后的配置.width
        窗口配置.height = 补偿后的配置.height
        使用保存的位置 = true
      }
    }
  }

  if (使用保存的位置 === false) {
    let 默认位置 = 获取默认窗口位置()
    窗口配置.x = 默认位置.x
    窗口配置.y = 默认位置.y
    窗口配置.width = 默认位置.width
    窗口配置.height = 默认位置.height
  }

  主窗口 = new BrowserWindow(窗口配置)
  配置DeepSeek窗口行为(主窗口)

  if (使用保存的位置 === true && 保存的状态 !== null) {
    await 验证并修正窗口(主窗口, 保存的状态)
  }

  主窗口.once('ready-to-show', () => {
    if (主窗口 !== null) {
      主窗口.show()
      if (保存的状态 !== null && 使用保存的位置 === true) {
        if (保存的状态.isMaximized === true) {
          主窗口.maximize()
        }
        if (保存的状态.isFullScreen === true) {
          主窗口.setFullScreen(true)
        }
      }
    }
  })

  if (开发环境 === true && process.env['OPEN_DEVTOOLS'] === 'true') {
    主窗口.webContents.openDevTools({ mode: 'detach', activate: false })
  }

  主窗口.on('close', async () => {
    if (主窗口 !== null) {
      await 保存窗口状态(主窗口, 窗口状态路径)
    }
  })

  主窗口.on('closed', () => {
    主窗口 = null
  })

  try {
    await 主窗口.loadURL(DEEPSEEK_首页地址)
  } catch (error) {
    console.error('DeepSeek 主窗口加载失败:', error)
  }
}

async function Electron就绪(): Promise<void> {
  app.setName('DeepSeek Desktop')
  配置DeepSeek会话()
  安装应用菜单(() => 主窗口)
  await 创建主窗口()
}

if (获得单实例锁 === false) {
  app.quit()
} else {
  app.on('ready', Electron就绪)
  app.on('second-instance', () => {
    if (主窗口 !== null) {
      if (主窗口.isMinimized() === true) 主窗口.restore()
      主窗口.focus()
    }
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('activate', async () => {
    if (主窗口 === null) await 创建主窗口()
  })
}
