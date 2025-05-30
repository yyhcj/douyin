"ui";
"auto";

// ===== 主界面设计 =====
ui.layout(
  <vertical padding="16" bg="#ffffff">
    <text
      text="抖音自动化脚本"
      textSize="20"
      textColor="#ff0050"
      marginBottom="16"
      gravity="center"
    />

    <vertical>
      <text
        text="抖音账号信息"
        textSize="16"
        textColor="#333333"
        marginBottom="8"
      />
      <input
        id="account"
        hint="输入抖音账号"
        text="23813965468"
        marginBottom="12"
      />
      <text
        text="私信内容"
        textSize="16"
        textColor="#333333"
        marginBottom="8"
      />
      <input
        id="message"
        hint="输入私信内容"
        text="你好，我看了你的作品觉得非常喜欢，可以交个朋友吗"
        marginBottom="20"
      />
    </vertical>

    <button
      id="start"
      text="开始执行"
      w="*"
      h="60"
      bg="#ff0050"
      textColor="#ffffff"
      marginBottom="12"
    />
    <button
      id="stop"
      text="停止脚本"
      w="*"
      h="40"
      bg="#999999"
      textColor="#ffffff"
      marginBottom="12"
    />

    <text
      text="执行日志"
      textSize="16"
      textColor="#333333"
      marginTop="12"
      marginBottom="8"
    />
    <scroll>
      <text id="log" textSize="12" textColor="#666666" margin="4" />
    </scroll>
  </vertical>
);

// ===== 常量定义 =====
const DURATION = 500; // 缩短操作间隔时间
const DURATION_LONG = 1500; // 缩短长等待时间
const MAX_RETRY = 5; // 最大重试次数
const PACKAGE_NAME = "com.ss.android.ugc.aweme"; // 抖音包名
const POPUP_TIMEOUT = 500; // 弹窗检测超时时间
const HOME_DETECT_TIMEOUT = 5000; // 首页检测超时时间
const FRIEND_PAGE_DETECT_TIMEOUT = 2000; // 好友页面检测超时时间
const SEARCH_BOX_TIMEOUT = 1000; // 搜索框查找超时时间
const SEARCH_BTN_TIMEOUT = 1500; // 搜索按钮查找超时时间
const PROFILE_DETECT_TIMEOUT = 1000; // 用户主页检测超时时间
const CHAT_BTN_TIMEOUT = 1000; // 私信按钮查找超时时间
const INPUT_BOX_TIMEOUT = 1000; // 消息输入框查找超时时间
const SEND_BTN_TIMEOUT = 1000; // 发送按钮查找超时时间
const MESSAGE_SEND_CHECK_TIMEOUT = 1000; // 消息发送检查超时时间

// ===== 全局变量 =====
let isRunning = false;
let targetAccount = "";
let messageContent = "";
let mainThread = null;
let monitorThread = null;

// ===== UI事件处理 =====
ui.start.click(() => {
  if (isRunning) return;

  targetAccount = ui.account.text().trim();
  messageContent = ui.message.text().trim();

  if (!targetAccount) {
    toast("请输入抖音账号");
    return;
  }

  if (!messageContent) {
    toast("请输入私信内容");
    return;
  }

  isRunning = true;
  ui.start.attr("bg", "#999999");
  ui.log.setText("");

  addLog("开始执行脚本...");
  addLog(`目标账号: ${targetAccount}`);
  addLog(`私信内容: ${messageContent}`);

  // 启动主线程
  setTimeout(() => {
    mainThread = threads.start(main);
  }, 100);
});

ui.stop.click(() => {
  if (!isRunning) return;

  isRunning = false;
  ui.start.attr("bg", "#ff0050");
  addLog("脚本已停止");

  // 中断所有线程
  if (mainThread) mainThread.interrupt();
  if (monitorThread) monitorThread.interrupt();
});

// ===== 主函数 =====
function main() {
  try {
    launchApp();
    goToAddFriendPage();
    searchAndAddAccount(targetAccount);
    enterUserProfile();
    sendPrivateMessage(messageContent);

    addLog("任务完成！");
    toast("任务执行成功");
  } catch (e) {
    if (e.message !== "thread interrupted") {
      addLog("发生错误: " + e.message);
      toast("任务执行失败: " + e.message);
    }
  } finally {
    isRunning = false;
    ui.run(() => ui.start.attr("bg", "#ff0050"));
  }
}

// ===== 功能函数 =====
function launchApp() {
  if (!isRunning) throw new Error("脚本已停止");
  addLog("正在启动抖音...");

  // 检查抖音是否已安装
  let isInstalled = false;
  try {
    const pm = context.getPackageManager();
    pm.getPackageInfo(PACKAGE_NAME, 0);
    isInstalled = true;
  } catch (e) {
    isInstalled = false;
  }

  if (!isInstalled) {
    throw new Error("未安装抖音应用");
  }

  // 尝试启动抖音
  app.launchPackage(PACKAGE_NAME);
  sleep(DURATION_LONG);

  // 处理可能的权限弹窗
  handlePermissionPopup();

  // 检测首页
  if (
    !waitForElement(textContains("推荐"), HOME_DETECT_TIMEOUT) &&
    !waitForElement(textContains("首页"), HOME_DETECT_TIMEOUT)
  ) {
    throw new Error("启动抖音失败，未检测到首页");
  }

  addLog("抖音启动成功");
  return true;
}

// 处理权限弹窗
function handlePermissionPopup() {
  addLog("检测权限弹窗...");

  const allowButtons = [
    { text: "允许" },
    { text: "始终允许" },
    { text: "确定" },
    { text: "好的" },
    { text: "同意" },
    { text: "打开" },
    { id: "android:id/button1" }, // 确认/允许按钮
    // 忽略拼写警告
    { id: "com.android.packageinstaller:id/permission_allow_button" },
  ];

  // 提取查找元素的逻辑到单独函数，减少超时时间
  function findElement(button) {
    try {
      if (button.text) {
        return text(button.text).findOne(POPUP_TIMEOUT);
      } else if (button.id) {
        return id(button.id).findOne(POPUP_TIMEOUT);
      }
    } catch (error) {
      addLog(`查找元素时出错: ${error.message}`);
    }
    return null;
  }

  for (let button of allowButtons) {
    const btn = findElement(button);
    if (btn) {
      addLog(`找到允许按钮: ${button.text || button.id}`);
      safeClick(btn);
      sleep(DURATION);
      return true;
    }
  }

  // 尝试点击屏幕中央处理未知弹窗，减少超时时间
  try {
    const popupWindow = className("android.app.Dialog").findOne(POPUP_TIMEOUT);
    if (popupWindow) {
      addLog("检测到弹窗窗口，尝试点击屏幕中央");
      safeClick(device.width / 2, device.height / 2);
      return true;
    }
  } catch (error) {
    addLog(`检测弹窗窗口时出错: ${error.message}`);
  }

  addLog("未检测到权限弹窗");
  return false;
}

function goToAddFriendPage() {
  if (!isRunning) throw new Error("脚本已停止");
  addLog("跳转到添加好友页面...");

  // 尝试点击底部"我"按钮
  for (let i = 0; i < 3; i++) {
    const profileTab = text("我").findOne(2000);
    if (profileTab) {
      safeClick(profileTab);
      sleep(DURATION_LONG);

      // 检查是否进入个人主页
      if (
        waitForElement(text("添加朋友"), FRIEND_PAGE_DETECT_TIMEOUT) ||
        waitForElement(text("抖音号"), FRIEND_PAGE_DETECT_TIMEOUT)
      ) {
        break;
      }
    }

    // 尝试通过坐标点击底部导航栏的"我"
    if (i === 1) {
      const tabCount = 4; // 底部有4个标签
      const tabIndex = 3; // "我"是第四个标签
      const tabWidth = device.width / tabCount;
      let clickX = tabWidth * tabIndex + tabWidth / 2;
      let clickY = device.height - 50; // 底部位置

      addLog(`尝试坐标点击底部导航栏: (${clickX}, ${clickY})`);
      safeClick(clickX, clickY);
      sleep(DURATION_LONG);
    }
  }

  // 验证是否在个人主页
  if (!waitForElement(text("添加朋友"), FRIEND_PAGE_DETECT_TIMEOUT)) {
    throw new Error("进入个人主页失败");
  }
  addLog("已进入个人主页");

  // 点击添加朋友按钮 - 优化定位逻辑
  let addFriendBtn = null;
  for (let i = 0; i < 3; i++) {
    // 尝试通过ID查找 - 抖音常见添加朋友按钮ID
    addFriendBtn =
      id("com.ss.android.ugc.aweme:id/c2c").findOne(2000) ||
      desc("添加朋友").findOne(2000) ||
      text("添加朋友").findOne(2000);

    if (addFriendBtn) {
      safeClick(addFriendBtn);
      sleep(DURATION_LONG);

      // 检查是否进入添加好友页面
      if (waitForElement(text("添加朋友"), FRIEND_PAGE_DETECT_TIMEOUT)) {
        addLog("已进入添加好友页面");
        return;
      }
    }

    // 尝试右上角坐标点击
    if (i === 1) {
      let clickX = device.width * 0.92; // 右上角区域
      let clickY = device.height * 0.08;

      addLog(`尝试坐标点击右上角: (${clickX}, ${clickY})`);
      safeClick(clickX, clickY);
      sleep(DURATION_LONG);

      if (waitForElement(text("添加朋友"), FRIEND_PAGE_DETECT_TIMEOUT)) {
        addLog("已进入添加好友页面");
        return;
      }
    }
  }

  throw new Error("进入添加好友页面失败");
}

function searchAndAddAccount(account) {
  if (!isRunning) throw new Error("脚本已停止");
  addLog(`搜索账号: ${account}...`);

  // 点击搜索框
  const searchBox =
    id("com.ss.android.ugc.aweme:id/search_kw").findOne(SEARCH_BOX_TIMEOUT) ||
    className("EditText").findOne(SEARCH_BOX_TIMEOUT);

  if (!searchBox) throw new Error("未找到搜索框");
  safeClick(searchBox);
  sleep(DURATION);

  // 输入账号
  setText(account);
  sleep(DURATION);

  // 点击搜索按钮
  const searchBtn =
    id("com.ss.android.ugc.aweme:id/search_btn").findOne(SEARCH_BTN_TIMEOUT) ||
    text("搜索").findOne(SEARCH_BTN_TIMEOUT);

  if (searchBtn) {
    safeClick(searchBtn);
  } else {
    KeyCode("KEYCODE_ENTER"); // 使用键盘搜索
  }
  sleep(DURATION_LONG);

  // 查找第一个搜索结果，排除搜索框本身
  const results = textContains(`抖音号:${account}`).find();
  let firstResult = results[0];

  if (!firstResult) throw new Error(`未找到指定用户: ${account}`);

  safeClick(firstResult);
  sleep(DURATION_LONG * 2);
  addLog(`找到用户: ${account}，点击成功`);
}

function enterUserProfile() {
  if (!isRunning) throw new Error("脚本已停止");
  addLog("进入用户主页...");

  // 验证是否在用户主页
  if (
    !waitForElement(textContains("作品"), PROFILE_DETECT_TIMEOUT) &&
    !waitForElement(textContains("动态"), PROFILE_DETECT_TIMEOUT)
  ) {
    throw new Error("进入用户主页失败");
  }
}

function sendPrivateMessage(message) {
  if (!isRunning) throw new Error("脚本已停止");
  addLog("发送私信...");

  // 点击私信按钮
  const chatBtn =
    id("com.ss.android.ugc.aweme:id/e2g").findOne(CHAT_BTN_TIMEOUT) ||
    textMatches("私信|发消息").findOne(CHAT_BTN_TIMEOUT);

  if (!chatBtn) throw new Error("未找到私信按钮");
  safeClick(chatBtn);
  sleep(DURATION_LONG);

  // 验证是否进入私信页面
  if (!waitForElement(className("EditText"), INPUT_BOX_TIMEOUT)) {
    throw new Error("进入私信页面失败");
  }

  // 输入消息
  const inputBox = className("EditText").findOne(INPUT_BOX_TIMEOUT);
  if (!inputBox) throw new Error("未找到消息输入框");

  safeClick(inputBox);
  sleep(DURATION);
  setText(message);
  sleep(DURATION);

  // 发送消息
  const sendBtn =
    id("com.ss.android.ugc.aweme:id/cp3").findOne(SEND_BTN_TIMEOUT) ||
    desc("发送").findOne(SEND_BTN_TIMEOUT);

  if (sendBtn) {
    safeClick(sendBtn);
  } else {
    KeyCode("KEYCODE_ENTER"); // 使用键盘发送
  }
  sleep(DURATION_LONG);

  // 验证消息是否发送成功
  if (waitForElement(text(message), MESSAGE_SEND_CHECK_TIMEOUT)) {
    addLog("私信发送成功");
  } else {
    throw new Error("发送私信失败");
  }
}

// ===== 辅助函数 =====
function addLog(logText) {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[${timestamp}] ${logText}`;

  // 在控制台输出日志
  console.log(logMessage);

  // 保留原有的 UI 日志更新逻辑
  ui.post(() => {
    ui.log.setText(ui.log.getText() + "\n" + logMessage);
  }, 0);
}

// 安全的点击函数
function safeClick(target) {
  if (!isRunning) return;

  if (typeof target === "number" && arguments.length === 2) {
    // 坐标点击
    press(target, arguments[1], 100);
    addLog(`点击坐标: (${target}, ${arguments[1]})`);
  } else if (target && target.bounds) {
    // 控件点击
    const bounds = target.bounds();
    const x = bounds.centerX();
    const y = bounds.centerY();
    press(x, y, 100);

    const desc = target.desc() || target.text() || target.id() || "未知控件";
    addLog(`点击控件: ${desc}`);
  } else if (typeof target === "object" && target.click) {
    // 直接调用click方法
    target.click();
    addLog(`直接点击控件`);
  }

  sleep(DURATION);
}

// 等待元素出现
function waitForElement(selector, timeout) {
  const endTime = Date.now() + timeout;
  while (Date.now() < endTime) {
    const element = selector.findOnce();
    if (element) return element;
    sleep(300); // 缩短轮询间隔
  }
  return null;
}

// 滚动查找元素
function findScrollableElement(selectorFunc, maxScrolls) {
  for (let i = 0; i < maxScrolls; i++) {
    const element = selectorFunc();
    if (element) return element;

    // 向下滚动
    swipe(
      device.width / 2,
      device.height * 0.7,
      device.width / 2,
      device.height * 0.3,
      300 // 缩短滑动时间
    );
    sleep(DURATION);
  }
  return null;
}

// ===== 监控线程 =====
monitorThread = threads.start(function () {
  while (true) {
    if (!isRunning) {
      sleep(1000);
      continue;
    }

    try {
      // 检查是否在抖音内
      if (currentPackage() !== PACKAGE_NAME) {
        addLog("检测到离开抖音，尝试返回...");
        back();
        sleep(DURATION_LONG);

        // 尝试返回抖音
        if (currentPackage() !== PACKAGE_NAME) {
          try {
            launchApp();
          } catch (e) {
            addLog("返回抖音失败: " + e.message);
          }
        }
      }
    } catch (e) {
      addLog("监控线程错误: " + e.message);
    }

    sleep(1500); // 缩短监控间隔
  }
});

// ===== 异常处理 =====
events.on("exit", () => {
  isRunning = false;
  ui.post(() => {
    ui.start.attr("bg", "#ff0050");
    addLog("脚本已退出");
  }, 0);

  // 中断所有线程
  if (mainThread) mainThread.interrupt();
  if (monitorThread) monitorThread.interrupt();
});
