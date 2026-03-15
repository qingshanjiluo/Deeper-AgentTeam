// src/ui/popup.js
// 弹出窗口脚本

document.addEventListener('DOMContentLoaded', () => {
  loadTeams();
  loadStats();
  
  // 绑定事件
  document.getElementById('create-team').addEventListener('click', createNewTeam);
  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.getElementById('sponsor-btn').addEventListener('click', openSponsor);
  document.getElementById('link-help').addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
  });
  document.getElementById('link-feedback').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ 
      url: 'mailto:sifangzhiji@qq.com?subject=Deeper AgentTeam 反馈' 
    });
  });
});

// 加载团队列表
function loadTeams() {
  chrome.runtime.sendMessage({ type: 'LIST_TEAMS' }, (res) => {
    const list = document.getElementById('team-list');
    
    if (!res.ok || !res.teams || res.teams.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">+</div>
          <p>还没有团队，快来创建一个吧！</p>
        </div>
      `;
      return;
    }
    
    list.innerHTML = res.teams.map(team => {
      const memberCount = team.members?.length || 0;
      const activeCount = team.members?.filter(m => m.status === 'sending' || m.status === 'waiting').length || 0;
      const hasActive = activeCount > 0;
      
      // 确定状态显示
      let statusClass = 'idle';
      let statusText = '空闲';
      if (team.status === 'running') {
        statusClass = 'active';
        statusText = '运行中';
      } else if (hasActive) {
        statusClass = 'sending';
        statusText = `活跃 (${activeCount})`;
      }
      
      return `
        <div class="team-item" data-id="${team.id}">
          <div class="team-name">${escapeHtml(team.name)}</div>
          <div class="team-meta">
            <span>${memberCount} 成员</span>
            <span class="team-status">
              <span class="status-dot ${statusClass}"></span>
              ${statusText}
            </span>
          </div>
        </div>
      `;
    }).join('');
    
    // 绑定点击事件
    list.querySelectorAll('.team-item').forEach(item => {
      item.addEventListener('click', () => {
        const teamId = item.dataset.id;
        openTeamInDeepSeek(teamId);
      });
    });
  });
}

// 加载统计信息
function loadStats() {
  chrome.runtime.sendMessage({ type: 'LIST_TEAMS' }, (res) => {
    if (!res.ok || !res.teams) return;
    
    const teams = res.teams;
    const totalMembers = teams.reduce((sum, t) => sum + (t.members?.length || 0), 0);
    const activeMembers = teams.reduce((sum, t) => {
      return sum + (t.members?.filter(m => m.status === 'sending' || m.status === 'waiting').length || 0);
    }, 0);
    
    document.getElementById('team-count').textContent = teams.length;
    document.getElementById('member-count').textContent = totalMembers;
    document.getElementById('active-count').textContent = activeMembers;
  });
}

// 创建新团队
function createNewTeam() {
  // 打开选项页面创建团队
  chrome.runtime.openOptionsPage(() => {
    // 发送消息切换到团队标签并打开创建模态框
    setTimeout(() => {
      chrome.tabs.query({ url: chrome.runtime.getURL('src/ui/options.html') }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_CREATE_TEAM' });
        }
      });
    }, 500);
  });
  window.close();
}

// 打开指定团队
function openTeamInDeepSeek(teamId) {
  chrome.runtime.sendMessage({ type: 'GET_TEAM', teamId }, (res) => {
    if (!res.ok || !res.team) return;
    
    const team = res.team;
    
    // 检查是否有成员
    if (!team.members || team.members.length === 0) {
      // 没有成员，打开设置页面添加成员
      chrome.runtime.openOptionsPage(() => {
        setTimeout(() => {
          chrome.tabs.query({ url: chrome.runtime.getURL('src/ui/options.html') }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_TEAM_DETAIL', teamId });
            }
          });
        }, 500);
      });
      window.close();
      return;
    }
    
    // 有成员，打开DeepSeek并开始团队任务
    chrome.tabs.query({ url: 'https://chat.deepseek.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        // 激活现有标签页
        chrome.tabs.update(tabs[0].id, { active: true });
        chrome.tabs.sendMessage(tabs[0].id, { type: 'OPEN_TEAM', teamId });
      } else {
        // 创建新标签页
        chrome.tabs.create({ url: 'https://chat.deepseek.com/' }, (tab) => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { type: 'OPEN_TEAM', teamId });
          }, 2000);
        });
      }
    });
    window.close();
  });
}

// 打开设置页面
function openSettings() {
  chrome.runtime.openOptionsPage();
  window.close();
}

// 打开赞助页面（跳转到options的赞助标签）
function openSponsor() {
  chrome.runtime.openOptionsPage(() => {
    // 尝试发送消息切换到赞助标签
    setTimeout(() => {
      chrome.tabs.query({ url: chrome.runtime.getURL('src/ui/options.html') }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SWITCH_TAB', tab: 'support' });
        }
      });
    }, 500);
  });
  window.close();
}

// HTML转义
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
