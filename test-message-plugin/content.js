// 测试插件的内容脚本
// 在DeepSeek页面上运行，用于测试消息发送

console.log('Message Test Plugin content script loaded on:', window.location.href);

// 检查页面是否包含DeepSeek聊天界面
function isDeepSeekChatPage() {
  return window.location.href.includes('chat.deepseek.com') && 
         document.querySelector('textarea, [contenteditable="true"], input');
}

// 查找输入框
function findInputElement() {
  // DeepSeek特定的选择器（根据观察到的HTML结构更新）
  const deepSeekSelectors = [
    // DeepSeek官方选择器（从HTML中观察到的）
    '.ds-scroll-area textarea',
    'textarea.ds-scroll-area',
    '._27c9245', // 从HTML中看到的类名
    '.d96f2d2a', // 从HTML中看到的类名
    '[class*="scroll-area"] textarea',
    '[class*="textarea"]',
    '[class*="input"]',
    
    // DeepSeek官方选择器
    '[data-testid="chat-input"]',
    '[data-testid="message-input"]',
    '.chat-input textarea',
    '.message-input textarea',
    '.input-area textarea',
    '.conversation-input textarea',
    
    // 通用选择器
    'textarea',
    '[contenteditable="true"]',
    'input[type="text"]',
    'input[type="search"]',
    
    // 占位符匹配（DeepSeek中文占位符）
    'input[placeholder*="给 DeepSeek 发送消息"]',
    'textarea[placeholder*="给 DeepSeek 发送消息"]',
    'input[placeholder*="消息"]',
    'input[placeholder*="输入"]',
    'input[placeholder*="Message"]',
    'input[placeholder*="message"]',
    'textarea[placeholder*="消息"]',
    'textarea[placeholder*="输入"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    
    // 类名匹配
    '.prose textarea',
    '.markdown textarea',
    '.input-textarea',
    '.chat-textarea',
    'form textarea',
    
    // ID匹配
    '#chat-input',
    '#message-input',
    '#input-text',
    '#text-input'
  ];
  
  console.log('开始查找输入框...');
  console.log('当前页面URL:', window.location.href);
  
  // 首先尝试DeepSeek特定选择器
  for (const selector of deepSeekSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`选择器 "${selector}" 找到 ${elements.length} 个元素`);
      
      for (const el of elements) {
        // 检查元素是否可见且可交互
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        const isNotDisabled = !el.disabled && !el.readOnly;
        const isInViewport = rect.top < window.innerHeight;
        
        // 检查是否在页面底部（聊天输入通常在底部）
        const isNearBottom = rect.bottom > window.innerHeight - 300;
        
        if (isVisible && isNotDisabled && isInViewport && isNearBottom) {
          console.log('找到输入框:', {
            selector,
            tagName: el.tagName,
            type: el.type,
            placeholder: el.placeholder,
            className: el.className,
            id: el.id,
            isContentEditable: el.isContentEditable,
            rect: {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right
            },
            isNearBottom
          });
          return el;
        } else if (isVisible && isNotDisabled && isInViewport) {
          // 即使不在底部也记录，但继续查找
          console.log('找到可能的输入框（不在底部）:', {
            selector,
            tagName: el.tagName,
            placeholder: el.placeholder,
            className: el.className
          });
        }
      }
    } catch (err) {
      console.log(`选择器 "${selector}" 错误:`, err.message);
    }
  }
  
  // 如果标准选择器失败，尝试更通用的方法
  console.log('标准选择器失败，尝试通用查找...');
  
  // 查找所有可能的输入元素
  const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
  console.log(`找到 ${allInputs.length} 个可能的输入元素`);
  
  // 按位置排序（底部的优先）
  const sortedInputs = Array.from(allInputs).sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    return rectB.bottom - rectA.bottom; // 底部位置更高的优先
  });
  
  for (const el of sortedInputs) {
    // 检查元素是否可见且可交互
    const rect = el.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0;
    const isNotDisabled = !el.disabled && !el.readOnly;
    const isInViewport = rect.top < window.innerHeight;
    
    if (isVisible && isNotDisabled && isInViewport) {
      console.log('使用回退方法找到输入框:', {
        tagName: el.tagName,
        placeholder: el.placeholder,
        className: el.className,
        rect: {
          top: rect.top,
          bottom: rect.bottom
        }
      });
      return el;
    }
  }
  
  console.log('未找到输入框');
  return null;
}

// 查找发送按钮
function findSendButton() {
  console.log('开始查找发送按钮...');
  
  // DeepSeek特定的选择器
  const deepSeekSelectors = [
    // DeepSeek官方按钮类
    '.ds-atom-button',
    '.ds-toggle-button',
    '.ds-icon-button',
    '[class*="ds-atom-button"]',
    '[class*="ds-toggle-button"]',
    '[class*="ds-icon-button"]',
    
    // 带有role="button"的div元素（DeepSeek常用）
    'div[role="button"]',
    '[role="button"][class*="ds-"]',
    
    // 标准选择器
    'button[type="submit"]',
    'button[aria-label*="发送"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Send"]',
    '.send-button',
    '[data-testid="send-button"]',
    'button svg', // 包含SVG的按钮
    'button > svg', // 直接包含SVG的按钮
    'button[class*="send"]',
    'button[class*="Send"]',
    'button:has(svg)', // 注意：:has() 选择器支持有限
    'form button:last-child', // 表单中的最后一个按钮
    'form button:not([type="button"])' // 表单中非普通按钮
  ];
  
  // 首先尝试DeepSeek特定选择器
  console.log('尝试DeepSeek特定选择器...');
  for (const selector of deepSeekSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      console.log(`选择器 "${selector}" 找到 ${elements.length} 个元素`);
      
      for (const el of elements) {
        // 检查元素是否可见且可交互
        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
        const isNotDisabled = !el.disabled && !el.getAttribute('aria-disabled');
        const isInViewport = el.getBoundingClientRect().top < window.innerHeight;
        
        if (isVisible && isNotDisabled && isInViewport) {
          // 检查是否在输入框附近（通常是发送按钮）
          const input = findInputElement();
          if (input) {
            const inputRect = input.getBoundingClientRect();
            const buttonRect = el.getBoundingClientRect();
            
            // 检查按钮是否在输入框附近（垂直位置相近）
            const isNearInput = Math.abs(buttonRect.bottom - inputRect.bottom) < 100;
            
            if (isNearInput) {
              console.log('找到发送按钮（DeepSeek选择器）:', {
                selector,
                tagName: el.tagName,
                className: el.className,
                ariaLabel: el.getAttribute('aria-label'),
                isNearInput
              });
              return el;
            }
          }
          
          // 如果没有输入框或不在附近，但元素看起来像按钮，也返回
          console.log('找到可能的发送按钮（DeepSeek选择器）:', {
            selector,
            tagName: el.tagName,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label')
          });
          return el;
        }
      }
    } catch (err) {
      // 忽略不支持的选择器错误
      console.log(`选择器 "${selector}" 错误:`, err.message);
    }
  }
  
  // 如果DeepSeek选择器失败，尝试文本内容匹配
  console.log('尝试通过文本内容查找发送按钮...');
  const allInteractiveElements = document.querySelectorAll('button, div[role="button"], [class*="button"]');
  for (const element of allInteractiveElements) {
    if (element.offsetWidth > 0 && element.offsetHeight > 0) {
      const isDisabled = element.disabled || element.getAttribute('aria-disabled') === 'true';
      if (isDisabled) continue;
      
      const text = element.textContent || element.innerText || '';
      const ariaLabel = element.getAttribute('aria-label') || '';
      const className = element.className || '';
      const tagName = element.tagName;
      
      // 检查是否包含发送相关文本
      const sendKeywords = ['发送', 'Send', 'send', '送出', '提交', '发送消息', '消息'];
      const hasSendText = sendKeywords.some(keyword =>
        text.includes(keyword) || ariaLabel.includes(keyword) || className.includes(keyword)
      );
      
      // 检查是否包含SVG（DeepSeek常用）
      const hasSvg = element.querySelector('svg') !== null;
      
      // 检查是否在页面底部（发送按钮通常在底部）
      const rect = element.getBoundingClientRect();
      const isNearBottom = rect.bottom > window.innerHeight - 200;
      
      if ((hasSendText || hasSvg) && isNearBottom) {
        console.log('找到发送按钮（文本/SVG）:', {
          tagName,
          text,
          ariaLabel,
          className,
          hasSvg,
          isNearBottom
        });
        return element;
      }
    }
  }
  
  // 最后尝试：查找表单中的主要按钮
  console.log('尝试查找表单中的按钮...');
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const formButtons = form.querySelectorAll('button, [role="button"]');
    if (formButtons.length > 0) {
      // 优先找type="submit"的按钮
      for (const button of formButtons) {
        if (button.type === 'submit' && button.offsetWidth > 0 && button.offsetHeight > 0 && !button.disabled) {
          console.log('找到表单提交按钮:', button);
          return button;
        }
      }
      // 如果没有type="submit"，返回最后一个按钮
      const lastButton = formButtons[formButtons.length - 1];
      if (lastButton.offsetWidth > 0 && lastButton.offsetHeight > 0 && !lastButton.disabled) {
        console.log('找到表单最后一个按钮:', lastButton);
        return lastButton;
      }
    }
  }
  
  // 尝试查找输入框附近的按钮
  console.log('尝试查找输入框附近的按钮...');
  const input = findInputElement();
  if (input) {
    const inputRect = input.getBoundingClientRect();
    const nearbyElements = document.elementsFromPoint(
      inputRect.right - 50,
      inputRect.bottom - 10
    );
    
    for (const element of nearbyElements) {
      if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
        if (element.offsetWidth > 0 && element.offsetHeight > 0 && !element.disabled) {
          console.log('找到输入框附近的按钮:', element);
          return element;
        }
      }
    }
  }
  
  console.warn('未找到发送按钮，将尝试键盘发送');
  return null;
}

// 发送消息到DeepSeek
async function sendTestMessage(text) {
  console.log('准备发送测试消息:', text);
  
  const input = findInputElement();
  if (!input) {
    throw new Error('找不到输入框');
  }
  
  // 记录原始值以便恢复
  const originalValue = input.value || input.textContent || '';
  
  try {
    // 聚焦输入框
    input.focus();
    
    // 设置值（根据元素类型）
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = text;
      // 触发输入事件
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (input.isContentEditable) {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    console.log('已设置文本:', text);
    
    // 等待一下让UI更新
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 查找并点击发送按钮
    const sendButton = findSendButton();
    let sendMethod = 'unknown';
    let sendSuccess = false;
    
    // 方法1：尝试点击发送按钮（针对DeepSeek优化）
    if (sendButton) {
      console.log('尝试点击发送按钮:', sendButton);
      console.log('按钮详细信息:', {
        tagName: sendButton.tagName,
        className: sendButton.className,
        ariaLabel: sendButton.getAttribute('aria-label'),
        role: sendButton.getAttribute('role'),
        type: sendButton.type
      });
      
      try {
        // 对于DeepSeek的ds-atom-button等，可能需要模拟更完整的点击
        if (sendButton.className && sendButton.className.includes('ds-')) {
          console.log('检测到DeepSeek按钮，使用增强点击方法');
          
          // 方法1A：标准点击
          sendButton.click();
          
          // 方法1B：触发鼠标事件（更完整）
          const mouseDownEvent = new MouseEvent('mousedown', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          sendButton.dispatchEvent(mouseDownEvent);
          
          const mouseUpEvent = new MouseEvent('mouseup', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          sendButton.dispatchEvent(mouseUpEvent);
          
          // 方法1C：触发焦点事件
          sendButton.focus();
          sendButton.dispatchEvent(new Event('focus', { bubbles: true }));
          
          // 等待一下让事件处理
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          // 标准按钮点击
          sendButton.click();
        }
        
        sendMethod = 'button_click';
        sendSuccess = true;
        console.log('发送按钮点击成功');
        
        // 等待一下让点击生效
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (buttonError) {
        console.error('发送按钮点击失败:', buttonError);
        
        // 尝试备用方法：模拟点击事件
        try {
          console.log('尝试备用点击方法');
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: sendButton.getBoundingClientRect().left + 10,
            clientY: sendButton.getBoundingClientRect().top + 10
          });
          sendButton.dispatchEvent(clickEvent);
          sendSuccess = true;
          sendMethod = 'button_click_alt';
          console.log('备用点击方法成功');
        } catch (altError) {
          console.error('备用点击方法也失败:', altError);
        }
      }
    }
    
    // 如果按钮点击失败或没有找到按钮，尝试键盘发送
    if (!sendSuccess) {
      console.log('尝试使用键盘发送');
      try {
        // 首先确保输入框有焦点
        input.focus();
        
        // 发送多个键盘事件以确保触发
        const keyboardEvents = [
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }),
          new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          }),
          new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          })
        ];
        
        // 也尝试Ctrl+Enter（某些聊天界面支持）
        const ctrlEnterEvents = [
          new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            ctrlKey: true,
            bubbles: true,
            cancelable: true
          }),
          new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            ctrlKey: true,
            bubbles: true,
            cancelable: true
          })
        ];
        
        // 触发所有事件
        for (const event of [...keyboardEvents, ...ctrlEnterEvents]) {
          input.dispatchEvent(event);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        sendMethod = 'keyboard';
        sendSuccess = true;
        console.log('键盘发送尝试完成');
      } catch (keyboardError) {
        console.error('键盘发送失败:', keyboardError);
      }
    }
    
    // 方法3：尝试表单提交
    if (!sendSuccess && input.form) {
      console.log('尝试表单提交');
      try {
        input.form.submit();
        sendMethod = 'form_submit';
        sendSuccess = true;
        console.log('表单提交尝试完成');
      } catch (formError) {
        console.error('表单提交失败:', formError);
      }
    }
    
    // 方法4：尝试触发可能的自定义事件
    if (!sendSuccess) {
      console.log('尝试触发自定义事件');
      try {
        // 触发可能的自定义发送事件
        input.dispatchEvent(new CustomEvent('send', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('chat-send', { bubbles: true }));
        
        // 查找可能的发送事件监听器
        const sendEvent = new Event('submit', { bubbles: true, cancelable: true });
        input.dispatchEvent(sendEvent);
        
        sendMethod = 'custom_event';
        sendSuccess = true;
        console.log('自定义事件触发尝试完成');
      } catch (eventError) {
        console.error('自定义事件触发失败:', eventError);
      }
    }
    
    // 等待一下，让发送操作有机会完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 检查消息是否已发送（通过观察输入框是否被清空）
    const currentValue = input.tagName === 'TEXTAREA' || input.tagName === 'INPUT'
      ? input.value
      : (input.isContentEditable ? input.textContent : '');
    
    const wasCleared = currentValue === '' || currentValue !== text;
    
    const result = {
      success: sendSuccess,
      message: text,
      timestamp: new Date().toISOString(),
      inputType: input.tagName,
      sent: sendSuccess,
      method: sendMethod,
      wasCleared: wasCleared,
      currentValue: currentValue.substring(0, 50) // 只记录前50个字符
    };
    
    console.log('消息发送结果:', result);
    
    if (!sendSuccess) {
      console.warn('所有发送方法都失败了，消息可能未发送');
      // 但仍然返回成功，因为至少文本已输入
      result.success = true;
      result.sent = false;
      result.warning = '文本已输入但可能未发送，请手动点击发送按钮';
    }
    
    return result;
    
  } catch (error) {
    console.error('发送消息时出错:', error);
    
    // 恢复原始值
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = originalValue;
    } else if (input.isContentEditable) {
      input.textContent = originalValue;
    }
    
    throw error;
  }
}

// 监听来自后台的消息
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.type === 'TEST_SEND_MESSAGE') {
      const { text } = message.payload || {};
      
      console.log('测试发送消息:', text);
      
      // 验证消息文本
      const validatedText = typeof text === 'string' ? text : 
                           (text === undefined || text === null ? '[测试消息 - 空值检测]' : String(text));
      
      console.log('验证后的消息:', validatedText);
      
      sendTestMessage(validatedText)
        .then(result => {
          console.log('发送成功:', result);
          sendResponse({ success: true, result });
        })
        .catch(error => {
          console.error('发送失败:', error);
          sendResponse({ 
            success: false, 
            error: error.message,
            validatedText,
            pageInfo: {
              url: window.location.href,
              hasInput: !!findInputElement(),
              hasSendButton: !!findSendButton(),
              isDeepSeek: isDeepSeekChatPage()
            }
          });
        });
      
      return true; // 保持消息通道开放
    }
    
    if (message.type === 'GET_PAGE_INFO') {
      sendResponse({
        url: window.location.href,
        title: document.title,
        hasInput: !!findInputElement(),
        hasSendButton: !!findSendButton(),
        isDeepSeek: isDeepSeekChatPage(),
        ready: true
      });
    }
  });
} else {
  console.warn('chrome.runtime API not available in content script');
}

// 页面加载完成后初始化
function init() {
  console.log('Message Test Plugin content script initialized');
  console.log('页面信息:', {
    url: window.location.href,
    hasInput: !!findInputElement(),
    hasSendButton: !!findSendButton(),
    isDeepSeek: isDeepSeekChatPage()
  });
  
  // 通知后台脚本页面已就绪
  if (chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'PAGE_READY',
      payload: {
        url: window.location.href,
        ready: true
      }
    }).catch(err => console.log('发送页面就绪消息失败:', err));
  }
}

// 等待页面加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('Message Test Plugin content script setup complete');