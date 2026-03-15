// src/content/panel.js
// DeepSeek AgentTeam - In-page Panel

(function() {
  'use strict';

  let panelVisible = false;
  let currentView = 'teams';
  let teams = {};
  let currentTeamId = null;

  // ==================== Panel Creation ====================
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'agentteam-panel';
    panel.innerHTML = `
      <div class="agentteam-header">
        <span class="agentteam-title">AgentTeam</span>
        <div class="agentteam-actions">
          <button class="agentteam-btn" id="at-minimize">-</button>
          <button class="agentteam-btn" id="at-close">x</button>
        </div>
      </div>
      <div class="agentteam-nav">
        <button class="agentteam-nav-btn active" data-view="teams">团队</button>
        <button class="agentteam-nav-btn" data-view="chat">聊天</button>
        <button class="agentteam-nav-btn" data-view="progress">进度</button>
        <button class="agentteam-nav-btn" data-view="logs">日志</button>
      </div>
      <div class="agentteam-content" id="at-content"></div>
    `;
    document.body.appendChild(panel);

    // Bind events
    document.getElementById('at-minimize').addEventListener('click', togglePanel);
    document.getElementById('at-close').addEventListener('click', hidePanel);
    
    panel.querySelectorAll('.agentteam-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.agentteam-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        render();
      });
    });

    // Load initial data
    loadTeams();
  }

  function togglePanel() {
    panelVisible = !panelVisible;
    const panel = document.getElementById('agentteam-panel');
    if (panel) {
      panel.classList.toggle('minimized', !panelVisible);
    }
  }

  function hidePanel() {
    panelVisible = false;
    const panel = document.getElementById('agentteam-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  function showPanel() {
    panelVisible = true;
    let panel = document.getElementById('agentteam-panel');
    if (!panel) {
      createPanel();
      panel = document.getElementById('agentteam-panel');
    }
    panel.style.display = 'flex';
    panel.classList.remove('minimized');
    render();
  }

  // ==================== Data Loading ====================
  function loadTeams() {
    chrome.runtime.sendMessage({ type: 'GET_TEAMS' }, (result) => {
      teams = result || {};
      render();
    });
  }

  // ==================== Rendering ====================
  function render() {
    const content = document.getElementById('at-content');
    if (!content) return;

    switch (currentView) {
      case 'teams':
        renderTeamList(content);
        break;
      case 'chat':
        renderChat(content);
        break;
      case 'progress':
        renderProgress(content);
        break;
      case 'logs':
        renderLogs(content);
        break;
    }
  }

  function renderTeamList(container) {
    const teamIds = Object.keys(teams);
    
    if (teamIds.length === 0) {
      container.innerHTML = `
        <div class="at-empty">
          <p>暂无团队</p>
          <p style="font-size: 12px; color: #888;">请在插件设置页面创建团队</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="at-team-list">
        ${teamIds.map(id => {
          const team = teams[id];
          return `
            <div class="at-team-item" data-team-id="${id}">
              <div class="at-team-name">${escapeHtml(team.name)}</div>
              <div class="at-team-meta">成员: ${team.members?.length || 0}</div>
              <div class="at-team-actions">
                <button class="at-btn at-btn-sm at-btn-primary at-start" data-team-id="${id}">启动</button>
                <button class="at-btn at-btn-sm at-btn-secondary at-select" data-team-id="${id}">选择</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.at-start').forEach(btn => {
      btn.addEventListener('click', () => startTeam(btn.dataset.teamId));
    });

    container.querySelectorAll('.at-select').forEach(btn => {
      btn.addEventListener('click', () => selectTeam(btn.dataset.teamId));
    });
  }

  function renderChat(container) {
    if (!currentTeamId || !teams[currentTeamId]) {
      container.innerHTML = `
        <div class="at-empty">
          <p>请先在"团队"页面选择一个团队</p>
        </div>
      `;
      return;
    }

    const team = teams[currentTeamId];
    container.innerHTML = `
      <div class="at-chat">
        <div class="at-chat-header">${escapeHtml(team.name)}</div>
        <div class="at-chat-channels">
          <button class="at-channel-btn active" data-channel="group">群聊</button>
          ${team.members?.map(m => `
            <button class="at-channel-btn" data-channel="${m.id}">${escapeHtml(m.name)}</button>
          `).join('') || ''}
        </div>
        <div class="at-chat-messages" id="at-messages"></div>
        <div class="at-chat-input">
          <textarea id="at-message-text" placeholder="输入消息..."></textarea>
          <button class="at-btn at-btn-primary" id="at-send-btn">发送</button>
        </div>
      </div>
    `;

    let currentChannel = 'group';

    container.querySelectorAll('.at-channel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.at-channel-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentChannel = btn.dataset.channel;
      });
    });

    document.getElementById('at-send-btn').addEventListener('click', () => {
      const text = document.getElementById('at-message-text').value.trim();
      if (!text) return;

      if (currentChannel === 'group') {
        chrome.runtime.sendMessage({
          type: 'BROADCAST_TEAM',
          teamId: currentTeamId,
          message: text
        });
      } else {
        chrome.runtime.sendMessage({
          type: 'SEND_TO_MEMBER',
          teamId: currentTeamId,
          memberId: currentChannel,
          message: text
        });
      }

      addMessage('我', text, true);
      document.getElementById('at-message-text').value = '';
    });
  }

  function addMessage(sender, text, isMe) {
    const container = document.getElementById('at-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `at-message ${isMe ? 'at-message-me' : ''}`;
    div.innerHTML = `
      <div class="at-message-sender">${escapeHtml(sender)}</div>
      <div class="at-message-text">${escapeHtml(text)}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function renderProgress(container) {
    if (!currentTeamId) {
      container.innerHTML = `
        <div class="at-empty">
          <p>请先在"团队"页面选择一个团队</p>
        </div>
      `;
      return;
    }

    chrome.runtime.sendMessage({ type: 'GET_PROGRESS', teamId: currentTeamId }, (progress) => {
      if (!progress) {
        container.innerHTML = '<div class="at-empty"><p>暂无进度信息</p></div>';
        return;
      }

      const team = teams[currentTeamId];
      const memberIds = Object.keys(progress.members || {});

      container.innerHTML = `
        <div class="at-progress">
          <div class="at-progress-header">
            <span>状态: ${progress.status === 'running' ? '进行中' : progress.status === 'interrupted' ? '已中断' : '已完成'}</span>
          </div>
          <div class="at-progress-list">
            ${team?.members?.map(member => {
              const memberProgress = progress.members[member.id] || {};
              const status = memberProgress.status || 'idle';
              const statusText = {
                idle: '空闲',
                sending: '发送中',
                waiting: '等待回复',
                completed: '已完成',
                error: '错误'
              }[status] || status;

              return `
                <div class="at-progress-item">
                  <span class="at-progress-name">${escapeHtml(member.name)}</span>
                  <span class="at-progress-status at-status-${status}">${statusText}</span>
                </div>
              `;
            }).join('') || '<p>暂无成员</p>'}
          </div>
        </div>
      `;
    });
  }

  function renderLogs(container) {
    chrome.runtime.sendMessage({ type: 'GET_LOGS' }, (logs) => {
      if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="at-empty"><p>暂无日志</p></div>';
        return;
      }

      container.innerHTML = `
        <div class="at-logs">
          ${logs.slice(0, 20).map(log => `
            <div class="at-log-item at-log-${log.level}">
              <span class="at-log-time">${formatTime(log.timestamp)}</span>
              <span class="at-log-message">${escapeHtml(log.message)}</span>
            </div>
          `).join('')}
        </div>
      `;
    });
  }

  // ==================== Actions ====================
  function startTeam(teamId) {
    const team = teams[teamId];
    if (!team || !team.members || team.members.length === 0) {
      alert('团队中没有成员');
      return;
    }

    if (!confirm('启动团队将为每个成员创建新的 DeepSeek 聊天页面。确定要继续吗？')) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'START_TEAM_CHAT',
      teamId: teamId
    }, (result) => {
      if (result && result.success) {
        alert('团队已启动');
        currentView = 'progress';
        currentTeamId = teamId;
        render();
      } else {
        alert('启动失败: ' + (result?.error || '未知错误'));
      }
    });
  }

  function selectTeam(teamId) {
    currentTeamId = teamId;
    currentView = 'chat';
    
    // Update nav
    const panel = document.getElementById('agentteam-panel');
    if (panel) {
      panel.querySelectorAll('.agentteam-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === 'chat') {
          btn.classList.add('active');
        }
      });
    }
    
    render();
  }

  // ==================== Button Injection ====================
  function injectButton() {
    // Check if button already exists
    if (document.getElementById('agentteam-toggle-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'agentteam-toggle-btn';
    btn.textContent = 'AgentTeam';
    btn.className = 'agentteam-floating-btn';
    btn.addEventListener('click', showPanel);
    document.body.appendChild(btn);
  }

  // ==================== Utils ====================
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN');
  }

  // ==================== Initialization ====================
  function init() {
    injectButton();
    
    // Listen for messages from background
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'SHOW_PANEL') {
          showPanel();
          sendResponse({ success: true });
        }
        if (msg.type === 'REFRESH_DATA') {
          loadTeams();
          sendResponse({ success: true });
        }
      });
    } else {
      console.warn('[AgentTeam Panel] chrome.runtime.onMessage API not available');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
