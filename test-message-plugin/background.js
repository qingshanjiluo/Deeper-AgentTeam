// 测试插件的后台脚本
// 用于诊断消息发送显示undefined的问题

console.log('Message Test Plugin background script loaded');

// 存储测试消息
let testMessages = [];

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'TEST_SEND_MESSAGE':
      testSendMessage(message.payload)
        .then(result => sendResponse({ success: true, result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // 保持消息通道开放以进行异步响应
      
    case 'GET_TEST_RESULTS':
      sendResponse({ success: true, messages: testMessages });
      break;
      
    case 'CLEAR_TEST_RESULTS':
      testMessages = [];
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// 测试发送消息到DeepSeek页面
async function testSendMessage(payload) {
  const { message, tabId, testType = 'direct' } = payload;
  
  console.log(`Testing message send: "${message}", type: ${testType}, tabId: ${tabId}`);
  
  const testResult = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    testType,
    originalMessage: message,
    processedMessage: null,
    sentToTab: tabId,
    result: null,
    error: null
  };
  
  try {
    // 记录原始消息
    testResult.processedMessage = typeof message === 'string' ? message : 
                                 (message === undefined || message === null ? '[空消息]' : String(message));
    
    // 根据测试类型执行不同的测试
    if (testType === 'direct' && tabId) {
      // 直接发送消息到标签页
      await chrome.tabs.sendMessage(tabId, {
        type: 'TEST_SEND_MESSAGE',
        payload: { text: message }
      });
      testResult.result = '消息已发送到内容脚本';
      
    } else if (testType === 'simulate') {
      // 模拟发送，不实际发送到页面
      testResult.result = '模拟发送完成';
      
    } else if (testType === 'create_tab') {
      // 创建新标签页并发送消息
      const tab = await chrome.tabs.create({
        url: 'https://chat.deepseek.com',
        active: false
      });
      
      testResult.sentToTab = tab.id;
      testResult.result = `新标签页已创建: ${tab.id}`;
      
      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 尝试发送消息
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'TEST_SEND_MESSAGE',
          payload: { text: message }
        });
        testResult.result += ', 消息发送成功';
      } catch (err) {
        testResult.error = `消息发送失败: ${err.message}`;
      }
    }
    
  } catch (error) {
    console.error('Test send error:', error);
    testResult.error = error.message;
    testResult.result = '发送失败';
  }
  
  // 保存测试结果
  testMessages.unshift(testResult);
  if (testMessages.length > 50) {
    testMessages = testMessages.slice(0, 50);
  }
  
  return testResult;
}

// 监听标签页更新，检查DeepSeek页面
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('chat.deepseek.com')) {
    console.log('DeepSeek页面加载完成:', tabId, tab.url);
    
    // 记录标签页信息
    const testResult = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      testType: 'tab_loaded',
      originalMessage: '页面加载检测',
      processedMessage: `DeepSeek页面加载完成: ${tab.url}`,
      sentToTab: tabId,
      result: '页面就绪',
      error: null
    };
    
    testMessages.unshift(testResult);
  }
});

console.log('Message Test Plugin background script initialized');