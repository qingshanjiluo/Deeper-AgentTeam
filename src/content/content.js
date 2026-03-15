// src/content/content.js
// DeepSeek AgentTeam - Content Script

(function() {
  'use strict';

  // ==================== Message Sending ====================
  async function sendMessage(text, options = {}) {
    return new Promise((resolve, reject) => {
      console.log('sendMessage called with text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      
      const input = findInputElement();
      if (!input) {
        console.error('输入框未找到');
        reject(new Error('Input element not found'));
        return;
      }

      console.log('找到输入框:', input);

      // 参考插件的文本插入方法
      input.focus();
      const current = input.value;
      let newValue;
      
      if (options.append && current.trim() !== '') {
        newValue = current + '\n\n' + text;
      } else {
        newValue = text;
      }
      
      input.value = newValue;
      
      // 触发事件，确保UI更新（参考插件的方法）
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      // 如果需要，触发其他事件
      if (options.simulateTyping) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
      }

      console.log('文本已插入，等待发送...');

      // 增加等待时间，确保UI更新
      setTimeout(() => {
        const sendButton = findSendButton();
        console.log('发送按钮:', sendButton);
        
        if (sendButton && sendButton.getAttribute('aria-disabled') !== 'true') {
          console.log('点击发送按钮');
          try {
            sendButton.click();
            console.log('发送按钮点击成功');
            resolve(true);
          } catch (error) {
            console.error('点击发送按钮失败:', error);
            // 尝试其他发送方法
            tryAlternativeSend(input, resolve, reject);
          }
        } else {
          console.log('发送按钮未找到或被禁用，尝试替代方法');
          tryAlternativeSend(input, resolve, reject);
        }
      }, options.delay || 500); // 增加延迟，确保UI更新
    });
  }

  function tryAlternativeSend(input, resolve, reject) {
    console.log('尝试替代发送方法');
    
    // 方法1: 模拟Ctrl+Enter
    try {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        ctrlKey: true,
        bubbles: true
      }));
      input.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        ctrlKey: true,
        bubbles: true
      }));
      console.log('Ctrl+Enter模拟成功');
      resolve(true);
      return;
    } catch (e) {
      console.log('Ctrl+Enter失败:', e);
    }
    
    // 方法2: 模拟Enter
    try {
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
      input.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
      console.log('Enter模拟成功');
      resolve(true);
      return;
    } catch (e) {
      console.log('Enter失败:', e);
    }
    
    // 方法3: 提交表单
    const form = input.closest('form');
    if (form) {
      try {
        form.dispatchEvent(new Event('submit', { bubbles: true }));
        console.log('表单提交成功');
        resolve(true);
        return;
      } catch (e) {
        console.log('表单提交失败:', e);
      }
    }
    
    console.error('所有发送方法都失败');
    reject(new Error('All send methods failed'));
  }

  function findInputElement() {
    const selectors = [
      // 参考插件使用的选择器（最优先）
      'textarea[placeholder*="发送消息"]',
      // DeepSeek官方和本地HTML选择器
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="说"]',
      // DeepSeek特定选择器
      '.ds-scroll-area textarea',
      '._27c9245', // 本地HTML中看到的类名
      '.d96f2d2a', // 本地HTML中看到的类名
      // 通用选择器
      'div[contenteditable="true"]',
      'textarea',
      '[data-testid="chat-input"]',
      '.chat-input textarea',
      'input[type="text"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        console.log('找到输入框，选择器:', selector, el);
        return el;
      }
    }

    // 回退：查找所有textarea并检查位置
    const textareas = document.querySelectorAll('textarea');
    for (const ta of textareas) {
      if (ta.placeholder && (ta.placeholder.includes('消息') || ta.placeholder.includes('Message') || ta.placeholder.includes('输入') || ta.placeholder.includes('说'))) {
        console.log('通过placeholder找到输入框:', ta.placeholder, ta);
        return ta;
      }
    }

    // 最后尝试：查找页面底部的textarea
    const allTextareas = Array.from(document.querySelectorAll('textarea'));
    if (allTextareas.length > 0) {
      // 选择最可能的一个（通常最后一个在底部）
      const lastTextarea = allTextareas[allTextareas.length - 1];
      console.log('使用最后一个textarea作为输入框:', lastTextarea);
      return lastTextarea;
    }

    console.warn('未找到输入框');
    return null;
  }

  function findSendButton() {
    const selectors = [
      // 参考插件使用的选择器
      'div._7436101[role="button"]',
      // DeepSeek特定选择器
      '.ds-atom-button[role="button"]',
      '.ds-icon-button[role="button"]',
      '.ds-toggle-button[role="button"]',
      'div[role="button"].ds-atom-button',
      'div[role="button"].ds-icon-button',
      // 通用选择器
      'button[type="submit"]',
      'button[aria-label*="发送"]',
      'button[aria-label*="Send"]',
      '.send-button',
      '[data-testid="send-button"]',
      'button svg[viewBox]',
      // 通过文本内容查找
      'button:has(svg)',
      'button:has(path)'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        console.log('找到发送按钮，选择器:', selector, el);
        // 确保返回的是可点击的元素
        const clickableEl = el.closest('button') || el;
        if (clickableEl.getAttribute('aria-disabled') === 'true') {
          console.log('发送按钮被禁用:', clickableEl);
          continue; // 尝试下一个选择器
        }
        return clickableEl;
      }
    }

    // 回退：查找所有按钮并检查位置和内容
    const buttons = document.querySelectorAll('button, div[role="button"]');
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      const isNearBottom = rect.top > window.innerHeight * 0.7; // 在页面底部70%以下
      const hasSendText = btn.textContent.includes('发送') || btn.textContent.includes('Send');
      const hasSendSvg = btn.querySelector('svg');
      
      if ((isNearBottom && hasSendSvg) || hasSendText) {
        console.log('通过位置找到发送按钮:', btn, '位置:', rect.top);
        if (btn.getAttribute('aria-disabled') !== 'true') {
          return btn;
        }
      }
    }

    console.warn('未找到发送按钮');
    return null;
  }

  function toggleDeepThink(enable) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent || '';
      if (text.includes('深度思考') || text.includes('Deep Think')) {
        const isActive = btn.classList.contains('active') || btn.getAttribute('aria-pressed') === 'true';
        if (enable !== isActive) {
          btn.click();
        }
        break;
      }
    }
  }

  function toggleWebSearch(enable) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent || '';
      if (text.includes('联网搜索') || text.includes('Web Search')) {
        const isActive = btn.classList.contains('active') || btn.getAttribute('aria-pressed') === 'true';
        if (enable !== isActive) {
          btn.click();
        }
        break;
      }
    }
  }

  // ==================== Reply Monitoring ====================
  function observeReplies() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const replyText = extractReplyText(node);
            if (replyText) {
              chrome.runtime.sendMessage({
                type: 'REPLY_RECEIVED',
                payload: {
                  text: replyText,
                  timestamp: Date.now(),
                  url: location.href
                }
              });
            }
          }
        }
      }
    });

    const chatContainer = document.querySelector('.chat-container, .messages-container, main, body');
    if (chatContainer) {
      observer.observe(chatContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  function extractReplyText(element) {
    const selectors = [
      '.message-content',
      '.chat-message',
      '[data-message-id]',
      '.prose',
      '.markdown-body'
    ];

    for (const selector of selectors) {
      const el = element.matches?.(selector) ? element : element.querySelector(selector);
      if (el && el.textContent) {
        return el.textContent.trim();
      }
    }

    if (element.textContent && element.textContent.length > 10) {
      return element.textContent.trim();
    }

    return null;
  }

  // ==================== Conversation Extraction ====================
  function extractConversation() {
    const messages = [];
    
    // 尝试多种选择器来找到对话内容
    const messageSelectors = [
      '[data-message-id]',
      '.chat-message',
      '.message-item',
      '.ds-message',
      '[class*="message"]'
    ];
    
    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) break;
    }
    
    // 如果找不到特定消息元素，尝试从DOM结构推断
    if (messageElements.length === 0) {
      // 查找包含用户和助手头像的区域
      const allElements = document.querySelectorAll('div, article');
      for (const el of allElements) {
        const text = el.textContent?.trim();
        if (text && text.length > 5 && text.length < 5000) {
          // 检查是否是用户消息或AI回复
          const isUser = el.querySelector('img')?.src?.includes('user') || 
                        el.closest('[data-role="user"]') !== null;
          const isAssistant = el.querySelector('[class*="assistant"]') !== null ||
                             el.closest('[data-role="assistant"]') !== null;
          
          if (isUser || isAssistant) {
            messages.push({
              role: isUser ? 'user' : 'assistant',
              content: text.substring(0, 2000)
            });
          }
        }
      }
    } else {
      messageElements.forEach(el => {
        const text = el.textContent?.trim();
        if (!text) return;
        
        // 判断是用户还是助手
        const isUser = el.classList.contains('user') || 
                      el.getAttribute('data-role') === 'user' ||
                      el.querySelector('.user-avatar') !== null;
        
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: text.substring(0, 2000)
        });
      });
    }
    
    return messages;
  }

  // ==================== Inline Toggle Button (参考DSM) ====================
  let teamToggleButton = null;
  let teamToggleMountTimer = null;
  let teamToggleObserver = null;
  let teamEnabled = false;

  function ensureInlineToggleStyle() {
    if (document.getElementById('deeperteam-toggle-style')) return;
    const style = document.createElement('style');
    style.id = 'deeperteam-toggle-style';
    style.textContent = `
      .deeperteam-inline-toggle-wrap {
        display: inline-flex;
        align-items: center;
        margin-right: 8px;
      }
      .deeperteam-inline-toggle.ds-atom-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 32px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid var(--dsr-border-2, #d9dce5);
        background: var(--dsr-bg-1, #ffffff);
        color: var(--dsw-alias-label-primary, #4f5868);
        cursor: pointer;
        user-select: none;
        transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
        font-family: "PingFang SC", "Microsoft YaHei UI", "Segoe UI", sans-serif;
      }
      .deeperteam-inline-toggle.ds-atom-button:hover {
        border-color: var(--dsr-border-3, #cbd3e0);
      }
      .deeperteam-inline-toggle.ds-atom-button:active {
        transform: translateY(1px);
      }
      .deeperteam-inline-toggle.ds-toggle-button--selected {
        color: var(--dsw-alias-brand-text, #4d6bfe);
        border-color: rgba(77, 107, 254, 0.35);
        background: rgba(77, 107, 254, 0.10);
      }
      .deeperteam-inline-toggle .deeperteam-label {
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        white-space: nowrap;
      }
      .deeperteam-inline-toggle .deeperteam-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #aeb7c4;
        flex: 0 0 8px;
        transition: background 140ms ease, box-shadow 140ms ease;
      }
      .deeperteam-inline-toggle.ds-toggle-button--selected .deeperteam-dot {
        background: #4d6bfe;
        box-shadow: 0 0 0 3px rgba(77, 107, 254, 0.16);
      }
      .deeperteam-inline-toggle .deeperteam-icon {
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function findComposerActionBar() {
    // 参考DSM的方式查找输入框旁边的操作栏
    const byClass = document.querySelector('.ec4f5d61, .composer-action-bar, [class*="action"]');
    if (byClass) return byClass;

    const searchTexts = [/联网搜索/, /web search/i, /search/i, /深度思考/, /deep think/i];
    const spans = Array.from(document.querySelectorAll('span, button'));
    for (const span of spans) {
      const text = String(span.textContent || '').trim();
      if (!text || !searchTexts.some((re) => re.test(text))) continue;
      const button = span.closest('[role="button"],button,div');
      if (!button || !button.parentElement) continue;
      const host = button.parentElement;
      if (host.querySelectorAll('[role="button"],button').length >= 2) {
        return host;
      }
    }

    // 查找包含文件上传输入框的区域
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      let node = fileInput.parentElement;
      for (let i = 0; i < 4 && node; i += 1) {
        if (node.querySelectorAll('[role="button"],button').length >= 2) {
          return node;
        }
        node = node.parentElement;
      }
    }

    // 最后尝试找到输入框附近的容器
    const input = findInputElement();
    if (input) {
      let node = input.parentElement;
      for (let i = 0; i < 5 && node; i += 1) {
        if (node.querySelectorAll('button').length >= 1) {
          return node;
        }
        node = node.parentElement;
      }
    }
    
    return null;
  }

  function renderToggleState() {
    if (!teamToggleButton) return;
    teamToggleButton.classList.toggle('ds-toggle-button--selected', teamEnabled);
    teamToggleButton.setAttribute('aria-pressed', teamEnabled ? 'true' : 'false');
    teamToggleButton.title = teamEnabled ? 'DeeperTeam 已开启，点击关闭' : 'DeeperTeam 已关闭，点击开启';
    const labelNode = teamToggleButton.querySelector('.deeperteam-label');
    if (labelNode) {
      labelNode.textContent = teamEnabled ? '团队开启' : '团队关闭';
    }
  }

  async function toggleTeamFromUi() {
    if (!teamToggleButton || teamToggleButton.dataset.busy === '1') return;
    teamToggleButton.dataset.busy = '1';
    try {
      teamEnabled = !teamEnabled;
      renderToggleState();
      
      // 通知background状态变化
      chrome.runtime.sendMessage({
        type: 'TEAM_TOGGLE_CHANGED',
        enabled: teamEnabled
      });
      
      // 如果开启，显示团队选择面板
      if (teamEnabled) {
        showTeamPanel();
      } else {
        hideTeamPanel();
      }
    } finally {
      if (teamToggleButton) {
        teamToggleButton.dataset.busy = '0';
      }
    }
  }

  function ensureInlineToggleMounted() {
    ensureInlineToggleStyle();
    const host = findComposerActionBar();
    if (!host) return false;

    let wrapper = host.querySelector('.deeperteam-inline-toggle-wrap');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'deeperteam-inline-toggle-wrap';
      const button = document.createElement('div');
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');
      button.setAttribute('aria-disabled', 'false');
      button.setAttribute('aria-pressed', 'false');
      button.className = 'deeperteam-inline-toggle ds-atom-button ds-toggle-button ds-toggle-button--md';
      button.style.transform = 'translateZ(0px)';
      button.innerHTML = `
        <div class="deeperteam-dot" aria-hidden="true"></div>
        <span><span class="deeperteam-label">团队关闭</span></span>
        <div class="ds-focus-ring"></div>
      `;
      button.addEventListener('click', () => {
        toggleTeamFromUi();
      });
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleTeamFromUi();
      });
      wrapper.appendChild(button);

      // 尝试插入到合适的位置（参考DSM）
      const uploadGroup = host.querySelector('.bf38813a, [class*="upload"], button');
      if (uploadGroup) {
        host.insertBefore(wrapper, uploadGroup);
      } else {
        host.appendChild(wrapper);
      }
      teamToggleButton = button;
    } else {
      teamToggleButton = wrapper.querySelector('.deeperteam-inline-toggle');
    }

    renderToggleState();
    return true;
  }

  function scheduleEnsureInlineToggle() {
    if (teamToggleMountTimer) {
      clearTimeout(teamToggleMountTimer);
    }
    teamToggleMountTimer = setTimeout(() => {
      ensureInlineToggleMounted();
    }, 120);
  }

  function startInlineToggleObserver() {
    if (teamToggleObserver) return;
    teamToggleObserver = new MutationObserver(() => {
      const mounted =
        teamToggleButton &&
        document.contains(teamToggleButton) &&
        teamToggleButton.closest('.deeperteam-inline-toggle-wrap');
      if (!mounted) {
        scheduleEnsureInlineToggle();
      }
    });
    teamToggleObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // ==================== Team Panel ====================
  let teamPanel = null;

  function showTeamPanel() {
    if (teamPanel) {
      teamPanel.style.display = 'block';
      loadTeamsForPanel();
      return;
    }

    teamPanel = document.createElement('div');
    teamPanel.id = 'deeperteam-floating-panel';
    teamPanel.innerHTML = `
      <style>
        #deeperteam-floating-panel {
          position: fixed;
          right: 20px;
          top: 80px;
          width: 300px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          border: 1px solid rgba(77, 107, 254, 0.2);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          z-index: 2147483646;
          font-family: "PingFang SC", "Microsoft YaHei UI", "Segoe UI", sans-serif;
          overflow: hidden;
        }
        .deeperteam-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: linear-gradient(135deg, #4d6bfe 0%, #6b7bfe 100%);
          color: white;
        }
        .deeperteam-panel-title {
          font-weight: 600;
          font-size: 14px;
        }
        .deeperteam-panel-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .deeperteam-panel-close:hover {
          background: rgba(255,255,255,0.2);
        }
        .deeperteam-panel-content {
          padding: 16px;
          max-height: 400px;
          overflow-y: auto;
        }
        .deeperteam-team-item {
          padding: 12px;
          border-radius: 8px;
          background: #f5f5f5;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .deeperteam-team-item:hover {
          background: #e8e8e8;
        }
        .deeperteam-team-name {
          font-weight: 600;
          font-size: 13px;
          color: #333;
          margin-bottom: 4px;
        }
        .deeperteam-team-meta {
          font-size: 11px;
          color: #888;
        }
        .deeperteam-team-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }
        .deeperteam-btn {
          flex: 1;
          padding: 6px 12px;
          border-radius: 6px;
          border: none;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .deeperteam-btn-primary {
          background: #4d6bfe;
          color: white;
        }
        .deeperteam-btn-primary:hover {
          background: #3d5bef;
        }
        .deeperteam-btn-secondary {
          background: #e0e0e0;
          color: #333;
        }
        .deeperteam-btn-secondary:hover {
          background: #d0d0d0;
        }
        .deeperteam-empty {
          text-align: center;
          color: #888;
          padding: 24px;
          font-size: 13px;
        }
      </style>
      <div class="deeperteam-panel-header">
        <span class="deeperteam-panel-title">DeeperTeam</span>
        <button class="deeperteam-panel-close">&times;</button>
      </div>
      <div class="deeperteam-panel-content" id="deeperteam-panel-content">
        <div class="deeperteam-empty">加载中...</div>
      </div>
    `;
    document.body.appendChild(teamPanel);

    teamPanel.querySelector('.deeperteam-panel-close').addEventListener('click', () => {
      teamPanel.style.display = 'none';
      teamEnabled = false;
      renderToggleState();
    });

    loadTeamsForPanel();
  }

  function hideTeamPanel() {
    if (teamPanel) {
      teamPanel.style.display = 'none';
    }
  }

  function loadTeamsForPanel() {
    const content = document.getElementById('deeperteam-panel-content');
    if (!content) return;

    chrome.runtime.sendMessage({ type: 'GET_TEAMS' }, (teams) => {
      if (!teams || Object.keys(teams).length === 0) {
        content.innerHTML = `
          <div class="deeperteam-empty">
            <div style="margin-bottom: 8px;">🤖</div>
            暂无团队<br>
            <span style="font-size: 11px;">请在插件设置页面创建团队</span>
          </div>
        `;
        return;
      }

      content.innerHTML = Object.values(teams).map(team => `
        <div class="deeperteam-team-item" data-team-id="${team.id}">
          <div class="deeperteam-team-name">${escapeHtml(team.name)}</div>
          <div class="deeperteam-team-meta">成员: ${team.members?.length || 0} 人</div>
          <div class="deeperteam-team-actions">
            <button class="deeperteam-btn deeperteam-btn-primary" data-action="start" data-team-id="${team.id}">启动</button>
            <button class="deeperteam-btn deeperteam-btn-secondary" data-action="chat" data-team-id="${team.id}">对话</button>
          </div>
        </div>
      `).join('');

      content.querySelectorAll('[data-action="start"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          startTeam(btn.dataset.teamId);
        });
      });

      content.querySelectorAll('[data-action="chat"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openTeamChat(btn.dataset.teamId);
        });
      });
    });
  }

  function startTeam(teamId) {
    chrome.runtime.sendMessage({
      type: 'START_TEAM_CHAT',
      teamId: teamId,
      initialMessage: '团队已启动，请等待任务分配。'
    }, (result) => {
      if (result && result.success) {
        showNotification('团队已启动！正在创建聊天页面...');
      } else {
        showNotification('启动失败: ' + (result?.error || '未知错误'), 'error');
      }
    });
  }

  function openTeamChat(teamId) {
    // 打开选项页面的聊天标签
    chrome.runtime.sendMessage({ type: 'OPEN_TEAM_CHAT', teamId });
    showNotification('已打开团队聊天界面');
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 2147483647;
      animation: slideDown 0.3s ease;
      ${type === 'error' 
        ? 'background: #ff4444; color: white;' 
        : 'background: #4d6bfe; color: white;'
      }
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideUp 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== Message Handler ====================
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'SEND_MESSAGE') {
        const { text, message, deepThink, webSearch, isFirstMessage } = msg.payload || {};
        
        // 支持 text 和 message 字段，优先使用 text
        const messageToSend = text || message;
        
        if (deepThink !== undefined) {
          toggleDeepThink(deepThink);
        }
        
        if (webSearch !== undefined) {
          toggleWebSearch(webSearch);
        }

        sendMessage(messageToSend)
          .then(() => sendResponse({ success: true, isFirstMessage }))
          .catch(err => sendResponse({ success: false, error: err.message }));

        return true;
      }

      if (msg.type === 'GET_PAGE_INFO') {
        sendResponse({
          url: location.href,
          title: document.title,
          ready: true
        });
      }

      if (msg.type === 'EXTRACT_CONVERSATION') {
        const conversation = extractConversation();
        sendResponse({ conversation });
        return true;
      }
    });
  } else {
    console.warn('[AgentTeam] chrome.runtime.onMessage API not available');
  }

  // ==================== Initialization ====================
  function init() {
    console.log('[AgentTeam] Content script initialized');
    observeReplies();
    
    // 初始化DSM风格的内嵌按钮
    ensureInlineToggleMounted();
    startInlineToggleObserver();
    scheduleEnsureInlineToggle();
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
