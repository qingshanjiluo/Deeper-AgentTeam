// 测试插件的弹出页面脚本

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // 元素引用
  const pageStatusEl = document.getElementById('page-status');
  const refreshStatusBtn = document.getElementById('refresh-status');
  const openDeepSeekBtn = document.getElementById('open-deepseek');
  const testMessageEl = document.getElementById('test-message');
  const testTypeEl = document.getElementById('test-type');
  const sendTestBtn = document.getElementById('send-test');
  const testResultsEl = document.getElementById('test-results');
  const clearResultsBtn = document.getElementById('clear-results');
  const viewLogsBtn = document.getElementById('view-logs');
  const diagnosticInfoEl = document.getElementById('diagnostic-info');
  
  // 特殊测试按钮
  const testEmptyBtn = document.getElementById('test-empty');
  const testUndefinedBtn = document.getElementById('test-undefined');
  const testNullBtn = document.getElementById('test-null');
  const testNumberBtn = document.getElementById('test-number');
  
  // 当前活动标签页ID
  let currentTabId = null;
  
  // 初始化
  loadPageStatus();
  loadTestResults();
  
  // 事件监听器
  refreshStatusBtn.addEventListener('click', loadPageStatus);
  openDeepSeekBtn.addEventListener('click', openDeepSeek);
  sendTestBtn.addEventListener('click', sendTestMessage);
  clearResultsBtn.addEventListener('click', clearTestResults);
  viewLogsBtn.addEventListener('click', viewLogs);
  
  // 特殊测试按钮事件
  testEmptyBtn.addEventListener('click', () => {
    testMessageEl.value = '';
    sendTestMessage();
  });
  
  testUndefinedBtn.addEventListener('click', () => {
    // 特殊处理：发送undefined值
    sendSpecialTest('undefined');
  });
  
  testNullBtn.addEventListener('click', () => {
    // 特殊处理：发送null值
    sendSpecialTest('null');
  });
  
  testNumberBtn.addEventListener('click', () => {
    testMessageEl.value = '123';
    sendTestMessage();
  });
  
  // 加载页面状态
  async function loadPageStatus() {
    pageStatusEl.innerHTML = '<span class="status-indicator status-offline"></span> 检测中...';
    
    try {
      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs.length === 0) {
        pageStatusEl.innerHTML = '<span class="status-indicator status-error"></span> 未找到活动标签页';
        currentTabId = null;
        return;
      }
      
      const currentTab = tabs[0];
      currentTabId = currentTab.id;
      
      // 检查是否是DeepSeek页面
      const isDeepSeek = currentTab.url && currentTab.url.includes('chat.deepseek.com');
      
      if (isDeepSeek) {
        // 获取页面详细信息
        try {
          const response = await chrome.tabs.sendMessage(currentTabId, {
            type: 'GET_PAGE_INFO'
          });
          
          if (response && response.ready) {
            pageStatusEl.innerHTML = `
              <span class="status-indicator status-online"></span> DeepSeek页面已就绪
              <div style="margin-top: 5px; font-size: 11px;">
                URL: ${currentTab.url}<br>
                输入框: ${response.hasInput ? '✓ 找到' : '✗ 未找到'}<br>
                发送按钮: ${response.hasSendButton ? '✓ 找到' : '✗ 未找到'}
              </div>
            `;
          } else {
            pageStatusEl.innerHTML = `
              <span class="status-indicator status-error"></span> DeepSeek页面但内容脚本未响应
              <div style="margin-top: 5px; font-size: 11px;">
                URL: ${currentTab.url}<br>
                可能内容脚本未加载
              </div>
            `;
          }
        } catch (err) {
          pageStatusEl.innerHTML = `
            <span class="status-indicator status-error"></span> DeepSeek页面但无法通信
            <div style="margin-top: 5px; font-size: 11px;">
              URL: ${currentTab.url}<br>
              错误: ${err.message}
            </div>
          `;
        }
      } else {
        pageStatusEl.innerHTML = `
          <span class="status-indicator status-offline"></span> 非DeepSeek页面
          <div style="margin-top: 5px; font-size: 11px;">
            当前页面: ${currentTab.url || '未知'}<br>
            请打开 <a href="https://chat.deepseek.com" target="_blank">chat.deepseek.com</a>
          </div>
        `;
      }
      
      // 更新诊断信息
      updateDiagnosticInfo(currentTab, isDeepSeek);
      
    } catch (error) {
      console.error('加载页面状态时出错:', error);
      pageStatusEl.innerHTML = `<span class="status-indicator status-error"></span> 错误: ${error.message}`;
    }
  }
  
  // 打开DeepSeek页面
  async function openDeepSeek() {
    try {
      const tab = await chrome.tabs.create({
        url: 'https://chat.deepseek.com',
        active: true
      });
      
      // 等待一会儿然后刷新状态
      setTimeout(loadPageStatus, 1000);
      
      addTestResult({
        type: 'info',
        message: '已打开DeepSeek页面',
        details: `标签页ID: ${tab.id}`,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('打开DeepSeek时出错:', error);
      addTestResult({
        type: 'error',
        message: '打开DeepSeek失败',
        details: error.message,
        timestamp: new Date()
      });
    }
  }
  
  // 发送测试消息
  async function sendTestMessage() {
    const message = testMessageEl.value;
    const testType = testTypeEl.value;
    
    console.log('发送测试消息:', { message, testType });
    
    // 添加发送记录
    addTestResult({
      type: 'info',
      message: `开始测试: ${testType}`,
      details: `消息: "${message}"`,
      timestamp: new Date()
    });
    
    try {
      // 发送到后台脚本
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_SEND_MESSAGE',
        payload: {
          message: message,
          tabId: currentTabId,
          testType: testType
        }
      });
      
      if (response.success) {
        const result = response.result;
        
        // 显示结果
        addTestResult({
          type: result.error ? 'error' : 'success',
          message: result.error ? `测试失败: ${testType}` : `测试成功: ${testType}`,
          details: result.error || result.result,
          originalMessage: result.originalMessage,
          processedMessage: result.processedMessage,
          timestamp: new Date(result.timestamp || Date.now())
        });
        
        // 更新诊断信息
        if (result.error) {
          diagnosticInfoEl.innerHTML = `
            <strong>最近错误:</strong><br>
            ${result.error}<br>
            <small>消息: "${result.processedMessage}"</small>
          `;
        }
        
      } else {
        addTestResult({
          type: 'error',
          message: '后台脚本错误',
          details: response.error || '未知错误',
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('发送测试消息时出错:', error);
      addTestResult({
        type: 'error',
        message: '发送测试失败',
        details: error.message,
        timestamp: new Date()
      });
    }
    
    // 重新加载测试结果
    loadTestResults();
  }
  
  // 发送特殊测试（undefined/null）
  async function sendSpecialTest(type) {
    console.log('发送特殊测试:', type);
    
    let messageValue;
    if (type === 'undefined') {
      messageValue = undefined;
    } else if (type === 'null') {
      messageValue = null;
    } else {
      messageValue = type;
    }
    
    addTestResult({
      type: 'info',
      message: `特殊测试: ${type}`,
      details: `值类型: ${typeof messageValue}, 值: ${messageValue}`,
      timestamp: new Date()
    });
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_SEND_MESSAGE',
        payload: {
          message: messageValue,
          tabId: currentTabId,
          testType: 'direct'
        }
      });
      
      if (response.success) {
        const result = response.result;
        addTestResult({
          type: result.error ? 'error' : 'success',
          message: result.error ? `${type}测试失败` : `${type}测试成功`,
          details: result.error || result.result,
          originalMessage: String(result.originalMessage),
          processedMessage: result.processedMessage,
          timestamp: new Date(result.timestamp || Date.now())
        });
      } else {
        addTestResult({
          type: 'error',
          message: `${type}测试失败`,
          details: response.error,
          timestamp: new Date()
        });
      }
    } catch (error) {
      addTestResult({
        type: 'error',
        message: `${type}测试异常`,
        details: error.message,
        timestamp: new Date()
      });
    }
    
    loadTestResults();
  }
  
  // 加载测试结果
  async function loadTestResults() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TEST_RESULTS'
      });
      
      if (response.success && response.messages && response.messages.length > 0) {
        // 清空现有结果（除了第一条提示）
        const existingItems = testResultsEl.querySelectorAll('.result-item');
        if (existingItems.length > 1 || 
            (existingItems.length === 1 && !existingItems[0].textContent.includes('等待测试'))) {
          testResultsEl.innerHTML = '';
        }
        
        // 显示最新的10条结果
        const recentMessages = response.messages.slice(0, 10);
        recentMessages.forEach(msg => {
          addTestResultToUI(msg);
        });
      }
    } catch (error) {
      console.error('加载测试结果时出错:', error);
    }
  }
  
  // 添加测试结果到UI
  function addTestResultToUI(result) {
    const resultItem = document.createElement('div');
    
    // 确定结果类型和样式
    let typeClass = 'result-info';
    if (result.type === 'success') typeClass = 'result-success';
    if (result.type === 'error') typeClass = 'result-error';
    
    // 格式化时间
    const time = result.timestamp instanceof Date ? result.timestamp : new Date(result.timestamp);
    const timeStr = time.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    // 构建结果HTML
    resultItem.className = `result-item ${typeClass}`;
    resultItem.innerHTML = `
      <div class="result-header">
        <span>${result.message || '测试结果'}</span>
        <span class="result-time">${timeStr}</span>
      </div>
      ${result.originalMessage ? `<div class="result-message"><strong>原始消息:</strong> "${result.originalMessage}"</div>` : ''}
      ${result.processedMessage ? `<div class="result-message"><strong>处理后的消息:</strong> "${result.processedMessage}"</div>` : ''}
      ${result.details ? `<div class="result-details">${result.details}</div>` : ''}
    `;
    
    // 添加到顶部
    testResultsEl.insertBefore(resultItem, testResultsEl.firstChild);
    
    // 限制显示数量
    const allItems = testResultsEl.querySelectorAll('.result-item');
    if (allItems.length > 10) {
      for (let i = 10; i < allItems.length; i++) {
        allItems[i].remove();
      }
    }
  }
  
  // 添加测试结果（简化版）
  function addTestResult(result) {
    addTestResultToUI(result);
  }
  
  // 清空测试结果
  async function clearTestResults() {
    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_TEST_RESULTS'
      });
      
      testResultsEl.innerHTML = `
        <div class="result-item result-info">
          <div class="result-header">
            <span>结果已清空</span>
            <span class="result-time">${new Date().toLocaleTimeString('zh-CN', { hour12: false })}</span>
          </div>
          <div class="result-message">点击"发送测试消息"开始新的测试</div>
        </div>
      `;
      
      addTestResult({
        type: 'info',
        message: '测试结果已清空',
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('清空测试结果时出错:', error);
    }
  }
  
  // 查看日志
  async function viewLogs() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TEST_RESULTS'
      });
      
      if (response.success && response.messages) {
        // 在诊断信息区域显示详细日志
        let logsHTML = '<strong>详细测试日志:</strong><br>';
        
        response.messages.slice(0, 20).forEach((msg, index) => {
          const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
          logsHTML += `
            <div class="log-entry ${msg.error ? 'log-error' : (msg.result && !msg.error ? 'log-success' : '')}">
              [${time}] ${msg.testType || 'info'}: ${msg.originalMessage || msg.message || '无消息'}<br>
              ${msg.processedMessage ? `处理为: "${msg.processedMessage}"<br>` : ''}
              ${msg.result ? `结果: ${msg.result}<br>` : ''}
              ${msg.error ? `错误: ${msg.error}` : ''}
            </div>
          `;
        });
        
        diagnosticInfoEl.innerHTML = logsHTML;
      }
    } catch (error) {
      diagnosticInfoEl.innerHTML = `<strong>获取日志失败:</strong> ${error.message}`;
    }
  }
  
  // 更新诊断信息
  function updateDiagnosticInfo(tab, isDeepSeek) {
    let infoHTML = '';
    
    if (isDeepSeek) {
      infoHTML = `
        <strong>DeepSeek页面诊断:</strong><br>
        • URL: ${tab.url}<br>
        • 标签页ID: ${tab.id}<br>
        • 状态: ${tab.status || '未知'}<br>
        • 建议: 点击"刷新状态"获取详细页面信息
      `;
    } else {
      infoHTML = `
        <strong>页面诊断:</strong><br>
        • 当前不是DeepSeek页面<br>
        • URL: ${tab.url || '未知'}<br>
        • 建议: 点击"打开DeepSeek"按钮
      `;
    }
    
    diagnosticInfoEl.innerHTML = infoHTML;
  }
  
  // 初始添加一条欢迎消息
  addTestResult({
    type: 'info',
    message: '消息测试插件已就绪',
    details: '使用此插件测试消息发送，诊断undefined问题',
    timestamp: new Date()
  });
  
  console.log('Popup initialization complete');
});