// src/ui/options.js
// DeepSeek AgentTeam Options Page

let currentTeams = {};
let currentTeamId = null;
let createStep = 1;
let currentChatTeamId = null;
let currentChatChannel = 'group';
let editingMemberId = null; // 当前编辑的成员ID

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadTeams();
  loadLogs();
  loadSettings();
  initModals();
  initChat();
  initConversationListener();
});

// ==================== Tabs ====================
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      document.getElementById(tabId).classList.add('active');
      
      if (tabId === 'progress') {
        loadProgressTeams();
      }
    });
  });
}

// ==================== Team Management ====================
function loadTeams() {
  chrome.runtime.sendMessage({ type: 'GET_TEAMS' }, (teams) => {
    currentTeams = teams || {};
    renderTeamList();
    updateTeamSelects();
  });
}

function renderTeamList() {
  const container = document.getElementById('team-list');
  const teamIds = Object.keys(currentTeams);
  
  if (teamIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">[ ]</div>
        <div class="empty-state-title">暂无团队</div>
        <p>点击上方按钮创建您的第一个团队</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = teamIds.map(id => {
    const team = currentTeams[id];
    return `
      <div class="team-card" data-team-id="${id}">
        <div class="team-card-header">
          <div class="team-card-title">${escapeHtml(team.name)}</div>
        </div>
        <div class="team-card-desc">${escapeHtml(team.description || '暂无描述')}</div>
        <div class="team-card-meta">
          <span>成员: ${team.members?.length || 0}</span>
          <span>创建于: ${formatDate(team.createdAt)}</span>
        </div>
        <div class="team-card-actions">
          <button class="btn btn-success btn-start" data-team-id="${id}">启动</button>
          <button class="btn btn-primary btn-manage" data-team-id="${id}">管理</button>
          <button class="btn btn-secondary btn-chat" data-team-id="${id}">聊天</button>
          <button class="btn btn-danger btn-delete" data-team-id="${id}">删除</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Bind events
  container.querySelectorAll('.team-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.btn')) {
        const teamId = card.dataset.teamId;
        openTeamDetail(teamId);
      }
    });
  });
  
  container.querySelectorAll('.btn-start').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startTeam(btn.dataset.teamId);
    });
  });
  
  container.querySelectorAll('.btn-manage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTeamDetail(btn.dataset.teamId);
    });
  });
  
  container.querySelectorAll('.btn-chat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTeamChat(btn.dataset.teamId);
    });
  });
  
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTeam(btn.dataset.teamId);
    });
  });
}

function updateTeamSelects() {
  const teamIds = Object.keys(currentTeams);
  const options = teamIds.map(id => `<option value="${id}">${escapeHtml(currentTeams[id].name)}</option>`).join('');
  
  const chatSelect = document.getElementById('chat-team-select');
  const progressSelect = document.getElementById('progress-team-select');
  
  if (chatSelect) {
    chatSelect.innerHTML = '<option value="">选择团队</option>' + options;
  }
  if (progressSelect) {
    progressSelect.innerHTML = '<option value="">选择团队</option>' + options;
  }
}

// ==================== Create Team ====================
function initModals() {
  // Create Team Modal
  document.getElementById('btn-create-team').addEventListener('click', () => {
    createStep = 1;
    showCreateStep(1);
    document.getElementById('create-team-modal').classList.add('active');
  });
  
  document.getElementById('close-create-modal').addEventListener('click', closeCreateModal);
  document.getElementById('btn-create-next').addEventListener('click', handleCreateNext);
  document.getElementById('btn-create-prev').addEventListener('click', () => {
    createStep = 1;
    showCreateStep(1);
  });
  
  // Team Detail Modal
  document.getElementById('close-detail-modal').addEventListener('click', () => {
    document.getElementById('team-detail-modal').classList.remove('active');
    currentTeamId = null;
  });
  
  document.getElementById('btn-save-team').addEventListener('click', saveTeamDetail);
  document.getElementById('btn-delete-team').addEventListener('click', () => {
    if (currentTeamId && confirm('确定要删除这个团队吗？此操作不可恢复。')) {
      deleteTeam(currentTeamId);
      document.getElementById('team-detail-modal').classList.remove('active');
    }
  });
  document.getElementById('btn-start-team').addEventListener('click', () => {
    if (currentTeamId) startTeam(currentTeamId);
  });
  
  // Add Member Modal
  document.getElementById('btn-add-member').addEventListener('click', () => {
    if (!currentTeamId) return;
    openAddMemberModal();
  });
  document.getElementById('close-member-modal').addEventListener('click', closeMemberModal);
  document.getElementById('btn-cancel-member').addEventListener('click', closeMemberModal);
  document.getElementById('btn-save-member').addEventListener('click', saveMember);
  
  // Member settings toggle - use team settings checkbox
  const useTeamSettingsCheckbox = document.getElementById('member-use-team-settings');
  if (useTeamSettingsCheckbox) {
    useTeamSettingsCheckbox.addEventListener('change', (e) => {
      const deepThink = document.getElementById('member-deep-think');
      const webSearch = document.getElementById('member-web-search');
      if (deepThink) deepThink.disabled = e.target.checked;
      if (webSearch) webSearch.disabled = e.target.checked;
    });
  }
  
  // Export/Import buttons
  document.getElementById('btn-export')?.addEventListener('click', exportData);
  document.getElementById('btn-import')?.addEventListener('click', () => {
    document.getElementById('import-file')?.click();
  });
  document.getElementById('import-file')?.addEventListener('change', importData);
}

function showCreateStep(step) {
  document.getElementById('create-step-1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('create-step-2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('btn-create-prev').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('btn-create-next').textContent = step === 1 ? '下一步' : '创建团队';
}

function handleCreateNext() {
  if (createStep === 1) {
    const name = document.getElementById('team-name').value.trim();
    if (!name) {
      showStatus('settings-status', '请输入团队名称', 'error');
      return;
    }
    createStep = 2;
    showCreateStep(2);
  } else {
    createTeam();
  }
}

function createTeam() {
  const teamData = {
    name: document.getElementById('team-name').value.trim(),
    description: document.getElementById('team-desc').value.trim(),
    sharedPrompt: document.getElementById('team-shared-prompt').value.trim(),
    auxPrompt: document.getElementById('team-aux-prompt').value.trim(),
    settings: {
      sendInterval: parseInt(document.getElementById('team-interval').value) || 5000,
      cleanupInterval: parseInt(document.getElementById('team-cleanup').value) || 3600000,
      maxConcurrentConversations: parseInt(document.getElementById('team-max-concurrent')?.value) || 0,
      deepThink: document.getElementById('team-deep-think').checked,
      webSearch: document.getElementById('team-web-search').checked,
      individualMemory: document.getElementById('team-individual-memory').checked,
      groupMemory: document.getElementById('team-group-memory').checked
    }
  };
  
  chrome.runtime.sendMessage({ type: 'CREATE_TEAM', teamData }, (result) => {
    if (result && !result.error) {
      closeCreateModal();
      loadTeams();
      showStatus('settings-status', '团队创建成功', 'success');
      // Reset form
      document.getElementById('team-name').value = '';
      document.getElementById('team-desc').value = '';
    } else {
      showStatus('settings-status', '创建失败: ' + (result?.error || '未知错误'), 'error');
    }
  });
}

function closeCreateModal() {
  document.getElementById('create-team-modal').classList.remove('active');
  createStep = 1;
}

// ==================== Team Detail ====================
function openTeamDetail(teamId) {
  currentTeamId = teamId;
  const team = currentTeams[teamId];
  if (!team) return;
  
  document.getElementById('detail-team-name').textContent = team.name;
  document.getElementById('detail-name').value = team.name;
  document.getElementById('detail-desc').value = team.description || '';
  
  renderMemberList(team);
  updateParentSelect(team);
  
  document.getElementById('team-detail-modal').classList.add('active');
}

function renderMemberList(team) {
  const container = document.getElementById('detail-member-list');
  if (!team.members || team.members.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center;">暂无成员</p>';
    return;
  }
  
  container.innerHTML = team.members.map(member => {
    const roleNames = {
      manager: '团队经理',
      programmer: '程序员',
      designer: '美工',
      planner: '策划',
      tester: '测试',
      writer: '文案',
      analyst: '分析师',
      member: '普通成员'
    };
    
    const parent = member.parentId ? team.members.find(m => m.id === member.parentId) : null;
    
    return `
      <div class="member-item" data-member-id="${member.id}">
        <div class="member-avatar">${member.name.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(member.name)}</div>
          <div class="member-role">${roleNames[member.role] || member.role}${parent ? ' / 上级: ' + escapeHtml(parent.name) : ''}</div>
        </div>
        <div class="member-actions">
          <button class="btn btn-secondary btn-edit-member" data-member-id="${member.id}">编辑</button>
          <button class="btn btn-danger btn-remove-member" data-member-id="${member.id}">删除</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Bind events
  container.querySelectorAll('.btn-remove-member').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('确定要删除这个成员吗？')) {
        removeMember(btn.dataset.memberId);
      }
    });
  });
  
  // Bind edit button events
  container.querySelectorAll('.btn-edit-member').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditMemberModal(btn.dataset.memberId);
    });
  });
}

function updateParentSelect(team) {
  const select = document.getElementById('member-parent');
  if (!select || !team) return;
  
  const options = team.members.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  select.innerHTML = '<option value="">无</option>' + options;
}

function saveTeamDetail() {
  if (!currentTeamId) return;
  
  const updates = {
    name: document.getElementById('detail-name').value.trim(),
    description: document.getElementById('detail-desc').value.trim()
  };
  
  chrome.runtime.sendMessage({ type: 'UPDATE_TEAM', teamId: currentTeamId, updates }, (result) => {
    if (result && !result.error) {
      loadTeams();
      showStatus('settings-status', '团队设置已保存', 'success');
    }
  });
}

function deleteTeam(teamId) {
  chrome.runtime.sendMessage({ type: 'DELETE_TEAM', teamId }, (result) => {
    if (result) {
      loadTeams();
      showStatus('settings-status', '团队已删除', 'success');
    }
  });
}

// ==================== Member Management ====================
function openAddMemberModal() {
  editingMemberId = null; // 重置编辑状态
  document.getElementById('member-modal-title').textContent = '添加成员';
  document.getElementById('member-save-text').textContent = '保存';
  
  // Reset form
  document.getElementById('member-name').value = '';
  document.getElementById('member-identifier').value = '';
  document.getElementById('member-role').value = 'member';
  document.getElementById('member-parent').value = '';
  document.getElementById('member-workflow').value = '';
  document.getElementById('member-desc').value = '';
  document.getElementById('member-custom-url').value = '';
  document.getElementById('member-prompt').value = '';
  
  // Reset member-specific settings
  const useTeamSettings = document.getElementById('member-use-team-settings');
  const deepThink = document.getElementById('member-deep-think');
  const webSearch = document.getElementById('member-web-search');
  if (useTeamSettings) useTeamSettings.checked = true;
  if (deepThink) deepThink.checked = false;
  if (webSearch) webSearch.checked = false;
  // Disable settings when using team defaults
  if (deepThink) deepThink.disabled = true;
  if (webSearch) webSearch.disabled = true;
  
  document.getElementById('add-member-modal').classList.add('active');
}

function openEditMemberModal(memberId) {
  if (!currentTeamId) return;
  
  const team = currentTeams[currentTeamId];
  if (!team || !team.members) return;
  
  const member = team.members.find(m => m.id === memberId);
  if (!member) return;
  
  editingMemberId = memberId;
  document.getElementById('member-modal-title').textContent = '编辑成员';
  document.getElementById('member-save-text').textContent = '更新';
  
  // Fill form with member data
  document.getElementById('member-name').value = member.name || '';
  document.getElementById('member-identifier').value = member.identifier || '';
  document.getElementById('member-role').value = member.role || 'member';
  document.getElementById('member-parent').value = member.parentId || '';
  document.getElementById('member-workflow').value = member.workflow || '';
  document.getElementById('member-desc').value = member.description || '';
  document.getElementById('member-custom-url').value = member.customUrl || '';
  document.getElementById('member-prompt').value = member.prompt || '';
  
  // Fill member-specific settings
  const useTeamSettings = document.getElementById('member-use-team-settings');
  const deepThink = document.getElementById('member-deep-think');
  const webSearch = document.getElementById('member-web-search');
  
  const useTeam = member.useTeamSettings !== false;
  if (useTeamSettings) useTeamSettings.checked = useTeam;
  if (deepThink) {
    deepThink.checked = member.deepThink || false;
    deepThink.disabled = useTeam;
  }
  if (webSearch) {
    webSearch.checked = member.webSearch || false;
    webSearch.disabled = useTeam;
  }
  
  document.getElementById('add-member-modal').classList.add('active');
}

function closeMemberModal() {
  document.getElementById('add-member-modal').classList.remove('active');
  editingMemberId = null;
  document.getElementById('member-modal-title').textContent = '添加团队成员';
  document.getElementById('member-save-text').textContent = '保存成员';
  // Clear form
  document.getElementById('member-name').value = '';
  document.getElementById('member-identifier').value = '';
  document.getElementById('member-role').value = 'member';
  document.getElementById('member-parent').value = '';
  document.getElementById('member-workflow').value = '';
  document.getElementById('member-desc').value = '';
  document.getElementById('member-prompt').value = '';
}

function saveMember() {
  if (!currentTeamId) return;
  
  const useTeamSettingsEl = document.getElementById('member-use-team-settings');
  const useTeamSettings = useTeamSettingsEl ? useTeamSettingsEl.checked : true;
  
  const memberData = {
    name: document.getElementById('member-name').value.trim(),
    identifier: document.getElementById('member-identifier').value.trim(),
    role: document.getElementById('member-role').value,
    parentId: document.getElementById('member-parent').value || null,
    workflow: document.getElementById('member-workflow').value.trim(),
    description: document.getElementById('member-desc').value.trim(),
    customUrl: document.getElementById('member-custom-url').value.trim() || undefined,
    prompt: document.getElementById('member-prompt').value.trim(),
    // Member-specific settings
    useTeamSettings: useTeamSettings,
    deepThink: useTeamSettings ? undefined : document.getElementById('member-deep-think')?.checked,
    webSearch: useTeamSettings ? undefined : document.getElementById('member-web-search')?.checked
  };
  
  if (!memberData.name) {
    alert('请输入成员名称');
    return;
  }
  if (!memberData.prompt) {
    alert('请输入提示词');
    return;
  }
  
  if (editingMemberId) {
    // Update existing member
    chrome.runtime.sendMessage({
      type: 'UPDATE_MEMBER',
      teamId: currentTeamId,
      memberId: editingMemberId,
      updates: memberData
    }, (result) => {
      if (result && !result.error) {
        closeMemberModal();
        // Refresh team data
        chrome.runtime.sendMessage({ type: 'GET_TEAM', teamId: currentTeamId }, (team) => {
          if (team) {
            currentTeams[currentTeamId] = team;
            renderMemberList(team);
            updateParentSelect(team);
          }
        });
      }
    });
  } else {
    // Add new member
    chrome.runtime.sendMessage({ type: 'ADD_MEMBER', teamId: currentTeamId, memberData }, (result) => {
      if (result && !result.error) {
        closeMemberModal();
        // Refresh team data
        chrome.runtime.sendMessage({ type: 'GET_TEAM', teamId: currentTeamId }, (team) => {
          if (team) {
            currentTeams[currentTeamId] = team;
            renderMemberList(team);
            updateParentSelect(team);
          }
        });
      }
    });
  }
}

function removeMember(memberId) {
  if (!currentTeamId) return;
  
  chrome.runtime.sendMessage({ type: 'REMOVE_MEMBER', teamId: currentTeamId, memberId }, (result) => {
    if (result) {
      chrome.runtime.sendMessage({ type: 'GET_TEAM', teamId: currentTeamId }, (team) => {
        if (team) {
          currentTeams[currentTeamId] = team;
          renderMemberList(team);
          updateParentSelect(team);
        }
      });
    }
  });
}

// ==================== Team Chat ====================
function initChat() {
  const teamSelect = document.getElementById('chat-team-select');
  teamSelect.addEventListener('change', () => {
    const teamId = teamSelect.value;
    if (teamId) {
      openTeamChat(teamId);
    } else {
      document.getElementById('chat-container').style.display = 'none';
      document.getElementById('chat-empty').style.display = 'block';
    }
  });
  
  document.getElementById('btn-send-message').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
}

async function openTeamChat(teamId) {
  currentChatTeamId = teamId;
  const team = currentTeams[teamId];
  if (!team) return;
  
  document.getElementById('chat-team-select').value = teamId;
  document.getElementById('chat-container').style.display = 'grid';
  document.getElementById('chat-empty').style.display = 'none';
  document.getElementById('chat-header').textContent = team.name + ' - 群聊';
  
  // Render member channels
  const memberChannels = document.getElementById('member-channels');
  memberChannels.innerHTML = team.members.map(member => `
    <div class="chat-channel" data-channel="${member.id}">
      <div class="chat-channel-name">${escapeHtml(member.name)}</div>
      <div class="chat-channel-status">${member.role}</div>
    </div>
  `).join('');
  
  // Bind channel click events with history loading
  document.querySelectorAll('.chat-channel').forEach(ch => {
    ch.addEventListener('click', async () => {
      document.querySelectorAll('.chat-channel').forEach(c => c.classList.remove('active'));
      ch.classList.add('active');
      currentChatChannel = ch.dataset.channel;
      const channelName = currentChatChannel === 'group' ? '群聊' :
        team.members.find(m => m.id === currentChatChannel)?.name || '私聊';
      document.getElementById('chat-header').textContent = team.name + ' - ' + channelName;
      
      // Load conversation history for selected member
      if (currentChatChannel !== 'group') {
        const history = await loadConversationHistory(teamId, currentChatChannel);
        renderConversationHistory(history, team);
      } else {
        // For group chat, load all conversations
        const allConvos = await loadAllConversations(teamId);
        const merged = [];
        Object.entries(allConvos).forEach(([memberId, messages]) => {
          if (Array.isArray(messages)) {
            messages.forEach(msg => merged.push({ ...msg, memberId }));
          } else {
            console.warn(`Messages for member ${memberId} is not an array:`, messages);
          }
        });
        merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        renderConversationHistory(merged, team);
      }
    });
  });
  
  // Load initial conversation history for all members (merged group view)
  const allConvos = await loadAllConversations(teamId);
  const merged = [];
  Object.entries(allConvos).forEach(([memberId, messages]) => {
    if (Array.isArray(messages)) {
      messages.forEach(msg => merged.push({ ...msg, memberId }));
    } else {
      console.warn(`Messages for member ${memberId} is not an array:`, messages);
    }
  });
  merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  renderConversationHistory(merged, team);
  
  // Switch to teams tab
  document.querySelector('[data-tab="chat"]').click();
}

function sendChatMessage() {
  if (!currentChatTeamId) return;
  
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  
  const team = currentTeams[currentChatTeamId];
  
  // Add message to chat
  addChatMessage('我', message, true);
  input.value = '';
  
  if (currentChatChannel === 'group') {
    // Broadcast to all members
    chrome.runtime.sendMessage({
      type: 'BROADCAST_TEAM',
      teamId: currentChatTeamId,
      message: message
    });
  } else {
    // Send to specific member
    chrome.runtime.sendMessage({
      type: 'SEND_TO_MEMBER',
      teamId: currentChatTeamId,
      memberId: currentChatChannel,
      message: message
    });
  }
}

function addChatMessage(sender, text, isMe = false) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.style.cssText = `
    margin-bottom: 16px;
    ${isMe ? 'text-align: right;' : ''}
  `;
  div.innerHTML = `
    <div style="
      display: inline-block;
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 12px;
      background: ${isMe ? '#1a73e8' : '#e8ecf4'};
      color: ${isMe ? 'white' : '#333'};
      text-align: left;
    ">
      <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">${escapeHtml(sender)}</div>
      <div>${escapeHtml(text)}</div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ==================== Start Team ====================
function startTeam(teamId) {
  const team = currentTeams[teamId];
  if (!team || !team.members || team.members.length === 0) {
    alert('团队中没有成员，请先添加成员');
    return;
  }
  
  if (!confirm('启动团队将为每个成员创建新的 DeepSeek 聊天页面并发送初始提示词。确定要继续吗？')) {
    return;
  }
  
  showStatus('settings-status', '正在启动团队...', 'info');
  
  chrome.runtime.sendMessage({
    type: 'START_TEAM_CHAT',
    teamId: teamId,
    initialMessage: '团队已启动，请等待任务分配。'
  }, (result) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showStatus('settings-status', '启动失败: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    if (result && result.success) {
      showStatus('settings-status', `团队已启动！创建了 ${result.tabsCreated || 0} 个新页面，共 ${result.memberCount} 个成员`, 'success');
      // Switch to progress tab
      document.querySelector('[data-tab="progress"]').click();
      document.getElementById('progress-team-select').value = teamId;
      loadProgress(teamId);
    } else {
      showStatus('settings-status', '启动失败: ' + (result?.error || '未知错误'), 'error');
    }
  });
}

// ==================== Progress ====================
function loadProgressTeams() {
  const select = document.getElementById('progress-team-select');
  select.addEventListener('change', () => {
    if (select.value) {
      loadProgress(select.value);
    } else {
      document.getElementById('progress-content').innerHTML = '<p style="color: #888; text-align: center;">选择团队查看进度</p>';
    }
  });
}

function loadProgress(teamId) {
  chrome.runtime.sendMessage({ type: 'GET_PROGRESS', teamId }, (progress) => {
    const container = document.getElementById('progress-content');
    
    if (!progress) {
      container.innerHTML = '<p style="color: #888; text-align: center;">暂无进度信息</p>';
      return;
    }
    
    const team = currentTeams[teamId];
    const memberIds = Object.keys(progress.members || {});
    const completedCount = memberIds.filter(id => progress.members[id].status === 'completed').length;
    const percentage = team?.members?.length ? Math.round((completedCount / team.members.length) * 100) : 0;
    
    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>总体进度</span>
          <span>${percentage}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div style="margin-top: 8px; font-size: 13px; color: #888;">
          状态: ${progress.status === 'running' ? '进行中' : progress.status === 'interrupted' ? '已中断' : '已完成'}
        </div>
      </div>
      <div class="member-list">
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
          
          const statusClass = {
            idle: 'badge-info',
            sending: 'badge-warning',
            waiting: 'badge-warning',
            completed: 'badge-success',
            error: 'badge-error'
          }[status] || 'badge-info';
          
          return `
            <div class="member-item">
              <div class="member-avatar">${member.name.charAt(0).toUpperCase()}</div>
              <div class="member-info">
                <div class="member-name">${escapeHtml(member.name)}</div>
                <div class="member-role">Tab ID: ${member.tabId || '未创建'}</div>
              </div>
              <div class="badge ${statusClass}">${statusText}</div>
            </div>
          `;
        }).join('') || '<p style="color: #888;">暂无成员</p>'}
      </div>
      <div class="btn-group" style="margin-top: 20px;">
        <button class="btn btn-danger" onclick="interruptTeam('${teamId}')">中断任务</button>
        <button class="btn btn-secondary" onclick="resetProgress('${teamId}')">重置进度</button>
      </div>
    `;
  });
}

function interruptTeam(teamId) {
  chrome.runtime.sendMessage({ type: 'INTERRUPT_TEAM', teamId }, () => {
    loadProgress(teamId);
  });
}

function resetProgress(teamId) {
  chrome.runtime.sendMessage({ type: 'RESET_PROGRESS', teamId }, () => {
    loadProgress(teamId);
  });
}

// ==================== Logs ====================
function loadLogs() {
  chrome.runtime.sendMessage({ type: 'GET_LOGS' }, (logs) => {
    renderLogs(logs || []);
  });
  
  document.getElementById('btn-refresh-logs').addEventListener('click', loadLogs);
  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    if (confirm('确定要清空所有日志吗？')) {
      chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' }, () => {
        loadLogs();
      });
    }
  });
  document.getElementById('log-filter').addEventListener('change', () => {
    loadLogs();
  });
}

function renderLogs(logs) {
  const filter = document.getElementById('log-filter').value;
  const container = document.getElementById('log-list');
  
  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.level === filter);
  
  if (filteredLogs.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center;">暂无日志</p>';
    return;
  }
  
  container.innerHTML = filteredLogs.map(log => `
    <div class="log-entry ${log.level}">
      <div class="log-time">${formatTime(log.timestamp)}</div>
      <div class="log-message">${escapeHtml(log.message)}</div>
    </div>
  `).join('');
}

// ==================== Settings ====================
function loadSettings() {
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importData);
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      chrome.storage.local.clear(() => {
        loadTeams();
        showStatus('settings-status', '所有数据已清空', 'success');
      });
    }
  });
}

function saveSettings() {
  const settings = {
    defaultInterval: parseInt(document.getElementById('setting-interval').value),
    maxLogs: parseInt(document.getElementById('setting-max-logs').value),
    cleanupInterval: parseInt(document.getElementById('setting-cleanup').value)
  };
  
  chrome.storage.local.set({ settings }, () => {
    showStatus('settings-status', '设置已保存', 'success');
  });
}

function exportData() {
  chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agentteam-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      chrome.runtime.sendMessage({ type: 'IMPORT_DATA', data }, (result) => {
        if (result && result.success) {
          loadTeams();
          showStatus('settings-status', '数据导入成功', 'success');
        }
      });
    } catch (err) {
      showStatus('settings-status', '导入失败: 无效的文件格式', 'error');
    }
  };
  reader.readAsText(file);
}

// ==================== Utils ====================
function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = 'status-message ' + type;
  setTimeout(() => {
    el.className = 'status-message';
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return '未知';
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN');
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
}

// Conversation history functions
function initConversationListener() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CONVERSATION_UPDATED') {
      const { teamId, memberId, message } = msg;
      
      // Only show in chat if it's for current team
      if (teamId === currentChatTeamId) {
        const isGroup = currentChatChannel === 'group';
        const isRelevantMember = currentChatChannel === memberId;
        
        if (isGroup || isRelevantMember) {
          const team = currentTeams[teamId];
          const member = team?.members.find(m => m.id === memberId);
          const sender = message.role === 'user' ? '我' : (member?.name || 'AI');
          const isMe = message.role === 'user';
          
          addChatMessage(sender, message.content, isMe);
        }
      }
    }
  });
}

async function loadConversationHistory(teamId, memberId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONVERSATION_HISTORY',
      teamId,
      memberId
    });
    
    if (response && response.history) {
      return response.history;
    }
  } catch (error) {
    console.error('Failed to load conversation history:', error);
  }
  return [];
}

async function loadAllConversations(teamId) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ALL_CONVERSATIONS',
      teamId
    });
    
    if (response) {
      return response;
    }
  } catch (error) {
    console.error('Failed to load all conversations:', error);
  }
  return {};
}

function renderConversationHistory(messages, team) {
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.innerHTML = '';
  
  if (!Array.isArray(messages)) {
    console.error('renderConversationHistory: messages is not an array', messages);
    return;
  }
  
  messages.forEach(msg => {
    const member = msg.memberId ? team.members.find(m => m.id === msg.memberId) : null;
    const sender = msg.role === 'user' ? '我' : (member?.name || 'AI');
    const isMe = msg.role === 'user';
    
    addChatMessage(sender, msg.content, isMe);
  });
}
