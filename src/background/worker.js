// src/background/worker.js
// DeepSeek AgentTeam - Background Service Worker

const CONFIG = {
  MAX_LOGS: 500,
  DEFAULT_SEND_INTERVAL: 5000,
  DEFAULT_CLEANUP_INTERVAL: 3600000, // 1 hour
  TAB_LOAD_TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000
};

// ==================== Data Storage ====================
let teams = {};
let teamLogs = [];
let teamProgress = {};
let teamTabs = {}; // teamId -> { memberName -> tabId }
let tabMemberMap = {}; // tabId -> { teamId, memberId }
let teamSessionState = {}; // sessionKey -> { promptSent: boolean, messages: [], active: boolean }
let conversationHistory = {}; // sessionKey -> [{role, content, timestamp}]

// ==================== Logger ====================
const Logger = {
  log(level, message, data = null) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: Date.now(),
      level,
      message,
      data
    };
    teamLogs.unshift(entry);
    if (teamLogs.length > CONFIG.MAX_LOGS) {
      teamLogs = teamLogs.slice(0, CONFIG.MAX_LOGS);
    }
    chrome.storage.local.set({ teamLogs });
    return entry;
  },
  info(message, data) { return this.log('info', message, data); },
  warn(message, data) { return this.log('warn', message, data); },
  error(message, data) { return this.log('error', message, data); },
  debug(message, data) { return this.log('debug', message, data); }
};

// ==================== Team Management ====================
function loadTeams() {
  chrome.storage.local.get(['teams'], (res) => {
    teams = res.teams || {};
    Logger.info('Teams loaded', { count: Object.keys(teams).length });
  });
  chrome.storage.local.get(['teamLogs'], (res) => {
    teamLogs = res.teamLogs || [];
  });
}

function saveTeams() {
  chrome.storage.local.set({ teams });
}

function createTeam(teamData) {
  const id = 'team_' + Date.now();
  const newTeam = {
    id,
    name: teamData.name,
    description: teamData.description || '',
    sharedPrompt: teamData.sharedPrompt || '',
    auxPrompt: teamData.auxPrompt || '',
    settings: {
      deepThink: teamData.settings?.deepThink || false,
      webSearch: teamData.settings?.webSearch || false,
      autoSwitch: teamData.settings?.autoSwitch !== false,
      sendInterval: teamData.settings?.sendInterval || CONFIG.DEFAULT_SEND_INTERVAL,
      cleanupInterval: teamData.settings?.cleanupInterval || 3600000,
      maxConcurrentConversations: teamData.settings?.maxConcurrentConversations || 0,
      individualMemory: teamData.settings?.individualMemory !== false,
      groupMemory: teamData.settings?.groupMemory !== false,
      reinforcementInterval: teamData.settings?.reinforcementInterval || 0 // 0表示不启用巩固，>0表示每N轮对话发送一次角色提示词
    },
    members: [],
    createdAt: Date.now()
  };
  teams[id] = newTeam;
  saveTeams();
  Logger.info('Team created', { teamId: id, name: newTeam.name });
  return newTeam;
}

function updateTeam(teamId, updates) {
  if (teams[teamId]) {
    Object.assign(teams[teamId], updates);
    saveTeams();
    Logger.info('Team updated', { teamId });
    return teams[teamId];
  }
  return null;
}

function deleteTeam(teamId) {
  delete teams[teamId];
  delete teamProgress[teamId];
  delete teamTabs[teamId];
  // Clean up session state
  Object.keys(teamSessionState).forEach(key => {
    if (key.startsWith(teamId + '_')) {
      delete teamSessionState[key];
    }
  });
  saveTeams();
  Logger.info('Team deleted', { teamId });
}

function addMember(teamId, memberData) {
  const team = teams[teamId];
  if (!team) return null;
  
  const member = {
    id: 'member_' + Date.now(),
    name: memberData.name,
    identifier: memberData.identifier || '',
    role: memberData.role || 'member',
    prompt: memberData.prompt || '',
    description: memberData.description || '',
    workflow: memberData.workflow || '',
    parentId: memberData.parentId || null,
    tabId: null,
    // Member-specific settings
    useTeamSettings: memberData.useTeamSettings !== false,
    deepThink: memberData.deepThink,
    webSearch: memberData.webSearch,
    createdAt: Date.now()
  };
  
  team.members.push(member);
  saveTeams();
  Logger.info('Member added', { teamId, memberId: member.id, name: member.name });
  return member;
}

function updateMember(teamId, memberId, updates) {
  const team = teams[teamId];
  if (!team) return null;
  
  const member = team.members.find(m => m.id === memberId);
  if (member) {
    // Handle member-specific settings
    const processedUpdates = { ...updates };
    if (updates.useTeamSettings !== undefined) {
      member.useTeamSettings = updates.useTeamSettings;
      if (updates.useTeamSettings) {
        // Clear member-specific settings when using team defaults
        member.deepThink = undefined;
        member.webSearch = undefined;
      }
    }
    if (!member.useTeamSettings) {
      if (updates.deepThink !== undefined) member.deepThink = updates.deepThink;
      if (updates.webSearch !== undefined) member.webSearch = updates.webSearch;
    }
    
    Object.assign(member, processedUpdates);
    saveTeams();
    Logger.info('Member updated', { teamId, memberId });
    return member;
  }
  return null;
}

function removeMember(teamId, memberId) {
  const team = teams[teamId];
  if (!team) return;
  
  const member = team.members.find(m => m.id === memberId);
  if (member && member.tabId) {
    chrome.tabs.remove(member.tabId).catch(() => {});
    delete tabMemberMap[member.tabId];
  }
  
  team.members = team.members.filter(m => m.id !== memberId);
  saveTeams();
  Logger.info('Member removed', { teamId, memberId });
}

// ==================== Tab Management ====================
async function createMemberTab(teamId, memberId) {
  const team = teams[teamId];
  const member = team?.members.find(m => m.id === memberId);
  if (!member) {
    Logger.error('Member not found', { teamId, memberId });
    return null;
  }
  
  try {
    Logger.info('Creating tab for member', { teamId, memberId, memberName: member.name, customUrl: member.customUrl });
    
    // Use custom URL if provided, otherwise use default
    const url = member.customUrl || 'https://chat.deepseek.com';
    
    const tab = await chrome.tabs.create({
      url: url,
      active: false
    });
    
    Logger.info('Tab created successfully', { tabId: tab.id, teamId, memberId, url });
    
    member.tabId = tab.id;
    tabMemberMap[tab.id] = { teamId, memberId };
    
    if (!teamTabs[teamId]) teamTabs[teamId] = {};
    teamTabs[teamId][memberId] = tab.id;
    
    saveTeams();
    Logger.info('Tab saved', { tabId: tab.id, teamId, memberId });
    
    // 监听标签页加载完成事件，发送初始提示词
    chrome.tabs.onUpdated.addListener(function listener(tabId_, info) {
      if (tabId_ === tab.id && info.status === 'complete') {
        // 移除监听器
        chrome.tabs.onUpdated.removeListener(listener);
        
        // 等待页面完全初始化
        setTimeout(async () => {
          try {
            // 发送初始提示词
            await sendInitialPrompts(teamId, memberId);
            Logger.info('Initial prompts sent successfully', { teamId, memberId });
          } catch (err) {
            Logger.error('Failed to send initial prompts', { teamId, memberId, error: err.message });
          }
        }, 3000); // 等待3秒确保页面完全加载
      }
    });
    
    return tab;
  } catch (err) {
    Logger.error('Failed to create tab', { teamId, memberId, error: err.message, errorStack: err.stack });
    return null;
  }
}

function closeMemberTab(teamId, memberId) {
  const team = teams[teamId];
  const member = team?.members.find(m => m.id === memberId);
  if (member?.tabId) {
    chrome.tabs.remove(member.tabId).catch(() => {});
    delete tabMemberMap[member.tabId];
    delete teamTabs[teamId]?.[memberId];
    member.tabId = null;
    saveTeams();
  }
}

async function switchToTab(tabId) {
  try {
    // First check if tab exists
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      Logger.error('Tab not found', { tabId });
      return false;
    }
    
    await chrome.tabs.update(tabId, { active: true });
    
    // Try to focus the window
    try {
      const win = await chrome.windows.get(tab.windowId);
      await chrome.windows.update(win.id, { focused: true });
    } catch (winErr) {
      // Window focus is less critical, just log
      Logger.debug('Could not focus window', { tabId, error: winErr.message });
    }
    
    Logger.info('Switched to tab', { tabId });
    return true;
  } catch (err) {
    Logger.error('Failed to switch tab', { tabId, error: err.message, errorStack: err.stack });
    return false;
  }
}

async function waitForTabLoad(tabId, timeout = CONFIG.TAB_LOAD_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeout);
    
    const listener = (tabId_, info) => {
      if (tabId_ === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(() => resolve(), 2000); // Extra wait for page init
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ==================== Message Building ====================
function buildBasePrompt(team, member) {
  let basePrompt = '';
  
  if (team.sharedPrompt) {
    basePrompt += team.sharedPrompt + '\n\n';
  }
  
  if (member.prompt) {
    basePrompt += '=== 你的角色设定 ===\n';
    basePrompt += member.prompt + '\n\n';
  }
  
  basePrompt += '=== 协作规则 ===\n';
  basePrompt += '1. 你是团队的一员，需要与其他成员协作完成任务\n';
  basePrompt += '2. 如果收到JSON格式的指令，请解析并执行\n';
  basePrompt += '3. 可以使用以下JSON命令与其他成员交互:\n';
  basePrompt += '   {"command": "sendTo", "target": "成员名", "message": "消息内容"}\n';
  basePrompt += '   {"command": "broadcast", "message": "广播消息"}\n';
  basePrompt += '   {"command": "complete", "result": "任务结果"}\n';
  
  return basePrompt;
}

function buildFollowUpMessage(team, member, message) {
  // For follow-up messages, just send the message directly without base prompt
  return message;
}

// ==================== Initial Prompts ====================
async function sendInitialPrompts(teamId, memberId) {
  const team = teams[teamId];
  const member = team?.members.find(m => m.id === memberId);
  
  if (!team || !member) {
    throw new Error('Team or member not found');
  }
  
  Logger.info('Sending initial prompts', { teamId, memberId, memberName: member.name });
  
  // 构建完整的初始消息
  let initialMessage = '';
  
  // 1. 团队提示词
  if (team.sharedPrompt) {
    initialMessage += `=== 团队任务与目标 ===\n${team.sharedPrompt}\n\n`;
  }
  
  // 2. 角色提示词
  if (member.prompt) {
    initialMessage += `=== 你的角色设定 ===\n${member.prompt}\n\n`;
  }
  
  // 3. 列出全部的角色和对应的身份标识
  if (team.members && team.members.length > 0) {
    initialMessage += '=== 团队成员列表 ===\n';
    team.members.forEach(m => {
      initialMessage += `- ${m.name}`;
      if (m.identifier) {
        initialMessage += ` (标识: ${m.identifier})`;
      }
      if (m.role && m.role !== 'member') {
        initialMessage += ` [${m.role}]`;
      }
      initialMessage += '\n';
    });
    initialMessage += '\n';
  }
  
  // 4. 协作规则
  initialMessage += '=== 协作规则 ===\n';
  initialMessage += '1. 你是团队的一员，需要与其他成员协作完成任务\n';
  initialMessage += '2. 如果收到JSON格式的指令，请解析并执行\n';
  initialMessage += '3. 可以使用以下JSON命令与其他成员交互:\n';
  initialMessage += '   {"command": "sendTo", "target": "成员名", "message": "消息内容"}\n';
  initialMessage += '   {"command": "broadcast", "message": "广播消息"}\n';
  initialMessage += '   {"command": "complete", "result": "任务结果"}\n';
  initialMessage += '   {"command": "ask", "question": "问题内容"}\n';
  initialMessage += '4. 请使用清晰的结构化格式回复，便于其他成员理解\n\n';
  
  // 5. 当前上下文
  initialMessage += '=== 当前上下文 ===\n';
  initialMessage += '这是你的初始设置。请确认你已理解以上信息，并准备好开始协作。\n';
  initialMessage += '你可以回复"已就绪"或提出任何疑问。\n';
  
  // 发送初始消息
  try {
    await sendMessageToMember(teamId, memberId, initialMessage, {
      isInitialPrompt: true,
      deepThink: member.useTeamSettings !== false ? team.settings.deepThink : member.deepThink,
      webSearch: member.useTeamSettings !== false ? team.settings.webSearch : member.webSearch
    });
    
    Logger.info('Initial prompts sent successfully', { teamId, memberId, messageLength: initialMessage.length });
    return true;
  } catch (err) {
    Logger.error('Failed to send initial prompts', { teamId, memberId, error: err.message });
    throw err;
  }
}

// ==================== Message Sending ====================
async function sendMessageToMember(teamId, memberId, message, options = {}) {
  const sessionKey = `${teamId}_${memberId}`;
  const team = teams[teamId];
  const member = team?.members.find(m => m.id === memberId);
  
  if (!team || !member) {
    throw new Error('Team or member not found');
  }
  
  // Log the incoming message for debugging
  Logger.info('sendMessageToMember called', {
    teamId,
    memberId,
    message: typeof message === 'string' ? message.substring(0, 100) : message,
    messageType: typeof message,
    options
  });
  
  // Initialize session state if not exists
  if (!teamSessionState[sessionKey]) {
    teamSessionState[sessionKey] = {
      promptSent: false,
      messages: [],
      active: true
    };
  }
  
  const isFirstMessage = !teamSessionState[sessionKey].promptSent;
  
  // Build message based on whether this is the first message
  let fullMessage;
  if (isFirstMessage) {
    const basePrompt = buildBasePrompt(team, member);
    fullMessage = basePrompt + '\n\n=== 当前任务 ===\n' + (message || '暂无具体任务');
    teamSessionState[sessionKey].promptSent = true;
    
    Logger.info('First message built', {
      teamId,
      memberId,
      basePromptLength: basePrompt.length,
      messageLength: message ? message.length : 0,
      fullMessageLength: fullMessage.length
    });
  } else {
    fullMessage = buildFollowUpMessage(team, member, message || '');
    Logger.info('Follow-up message built', { teamId, memberId, messageLength: fullMessage.length });
  }
  
  // Store the message in conversation history
  // Use safe message value to avoid undefined
  const safeMessage = typeof message === 'string' ? message :
                     (message === undefined || message === null ? '' : String(message));
  storeMessage(teamId, memberId, 'user', safeMessage);
  
  // Create tab if needed
  if (!member.tabId) {
    await createMemberTab(teamId, memberId);
    await waitForTabLoad(member.tabId);
  }
  
  // Determine settings: member-specific > team settings
  let deepThinkEnabled, webSearchEnabled;
  
  // Check if member uses team settings (default true if not specified)
  if (member.useTeamSettings !== false) {
    // Use team settings
    deepThinkEnabled = team.settings.deepThink ?? false;
    webSearchEnabled = team.settings.webSearch ?? false;
  } else {
    // Use member-specific settings
    deepThinkEnabled = member.deepThink ?? false;
    webSearchEnabled = member.webSearch ?? false;
  }
  
  // Allow options to override
  if (options.deepThink !== undefined) deepThinkEnabled = options.deepThink;
  if (options.webSearch !== undefined) webSearchEnabled = options.webSearch;
  
  // Send message via content script
  try {
    // Ensure tab is loaded before sending message
    if (member.tabId) {
      try {
        // Check if tab exists and is accessible
        const tab = await chrome.tabs.get(member.tabId);
        if (tab.status === 'complete') {
          // Switch to the member's tab before sending message
          await switchToTab(member.tabId);
          
          try {
            await chrome.tabs.sendMessage(member.tabId, {
              type: 'SEND_MESSAGE',
              payload: {
                text: fullMessage,
                deepThink: deepThinkEnabled,
                webSearch: webSearchEnabled
              }
            });
            
            Logger.info('Message sent to member', {
              teamId,
              memberId,
              isFirstMessage,
              messageLength: fullMessage.length
            });
            
            // Update member status
            ProgressManager.updateMemberStatus(teamId, memberId, 'sending', {
              lastMessage: message.substring(0, 100)
            });
            
            return { success: true, isFirstMessage };
          } catch (sendErr) {
            // Check if error is "Receiving end does not exist"
            if (sendErr.message && sendErr.message.includes('Receiving end does not exist')) {
              Logger.warn('Content script not ready, waiting and retrying', { teamId, memberId });
              // Wait a bit for content script to load
              await sleep(2000);
              // Retry sending
              return await sendMessageToMember(teamId, memberId, message, options);
            }
            throw sendErr;
          }
        } else {
          // Tab not fully loaded, wait for it
          await waitForTabLoad(member.tabId);
          // Retry sending
          return await sendMessageToMember(teamId, memberId, message, options);
        }
      } catch (tabErr) {
        // Tab might be closed or inaccessible, recreate it
        Logger.warn('Tab inaccessible, recreating', { teamId, memberId, error: tabErr.message });
        await createMemberTab(teamId, memberId);
        await waitForTabLoad(member.tabId);
        // Retry sending
        return await sendMessageToMember(teamId, memberId, message, options);
      }
    } else {
      // No tab exists, create one
      await createMemberTab(teamId, memberId);
      await waitForTabLoad(member.tabId);
      // Retry sending
      return await sendMessageToMember(teamId, memberId, message, options);
    }
  } catch (err) {
    Logger.error('Failed to send message', { teamId, memberId, error: err.message, errorStack: err.stack });
    throw err;
  }
}

// Track active conversations per team
const activeConversations = {};
const messageQueue = {};

async function broadcastToTeam(teamId, message, options = {}) {
  const team = teams[teamId];
  if (!team || !team.members.length) {
    throw new Error('Team has no members');
  }
  
  // Ensure message is not undefined
  const safeMessage = typeof message === 'string' ? message :
                     (message === undefined || message === null ? '' : String(message));
  
  Logger.info('broadcastToTeam called', {
    teamId,
    teamName: team.name,
    message: typeof safeMessage === 'string' ? safeMessage.substring(0, 100) : safeMessage,
    messageType: typeof safeMessage,
    memberCount: team.members.length,
    options
  });
  
  const maxConcurrent = team.settings.maxConcurrentConversations || 0;
  const results = [];
  
  // If no limit or limit is 0, send to all members
  if (maxConcurrent === 0) {
    for (const member of team.members) {
      try {
        const result = await sendMessageToMember(teamId, member.id, safeMessage, options);
        results.push({ memberId: member.id, success: true, result });
      } catch (err) {
        results.push({ memberId: member.id, success: false, error: err.message });
      }
      
      // Small delay between sends
      if (team.settings.autoSwitch !== false) {
        await sleep(500);
      }
    }
  } else {
    // With limit: process members in batches
    const members = [...team.members];
    let batchIndex = 0;
    
    while (members.length > 0) {
      const batch = members.splice(0, maxConcurrent);
      batchIndex++;
      
      Logger.info(`Processing batch ${batchIndex} with ${batch.length} members`, { teamId });
      
      // Send to current batch
      for (const member of batch) {
        try {
          const result = await sendMessageToMember(teamId, member.id, safeMessage, options);
          results.push({ memberId: member.id, success: true, result });
        } catch (err) {
          results.push({ memberId: member.id, success: false, error: err.message });
        }
        
        // Small delay between sends
        if (team.settings.autoSwitch !== false) {
          await sleep(500);
        }
      }
      
      // Wait for batch to complete before next batch
      if (members.length > 0) {
        Logger.info(`Batch ${batchIndex} complete. Waiting for next batch...`, { teamId });
        // Wait for the batch members to complete their tasks
        await waitForBatchCompletion(teamId, batch);
      }
    }
  }
  
  Logger.info('Broadcast complete', { teamId, messageLength: safeMessage.length, results });
  return results;
}

async function waitForBatchCompletion(teamId, batchMembers) {
  const maxWaitTime = 60000; // Max 60 seconds wait
  const checkInterval = 2000; // Check every 2 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const allComplete = batchMembers.every(member => {
      const sessionKey = `${teamId}_${member.id}`;
      // Check if member has pending responses or is still processing
      return isMemberIdle(teamId, member.id);
    });
    
    if (allComplete) {
      return;
    }
    
    await sleep(checkInterval);
  }
  
  Logger.warn('Batch completion wait timeout', { teamId });
}

function isMemberIdle(teamId, memberId) {
  // Check member status in progress tracker
  const progress = teamProgress[teamId];
  if (!progress || !progress.members[memberId]) {
    return true;
  }
  
  const status = progress.members[memberId].status;
  // Consider member idle if status is completed, idle, or error
  return ['completed', 'idle', 'error'].includes(status);
}

// ==================== Conversation History ====================
function storeMessage(teamId, memberId, role, content) {
  const sessionKey = `${teamId}_${memberId}`;
  
  // Ensure content is a string, not undefined
  const safeContent = typeof content === 'string' ? content :
                     (content === undefined || content === null ? '' : String(content));
  
  if (!conversationHistory[sessionKey]) {
    conversationHistory[sessionKey] = [];
  }
  
  conversationHistory[sessionKey].push({
    role,
    content: safeContent,
    timestamp: Date.now()
  });
  
  // Also store in session state for backward compatibility
  if (!teamSessionState[sessionKey]) {
    teamSessionState[sessionKey] = {
      promptSent: false,
      messages: [],
      active: true
    };
  }
  
  teamSessionState[sessionKey].messages.push({
    role,
    content: safeContent,
    timestamp: Date.now()
  });
}

function getConversationHistory(teamId, memberId) {
  const sessionKey = `${teamId}_${memberId}`;
  return conversationHistory[sessionKey] || [];
}

// Clear conversation history for a team or specific member
function clearConversationHistory(teamId, memberId = null) {
  if (memberId) {
    const sessionKey = `${teamId}_${memberId}`;
    delete conversationHistory[sessionKey];
    delete teamSessionState[sessionKey];
  } else {
    // Clear all members in the team
    Object.keys(conversationHistory).forEach(key => {
      if (key.startsWith(`${teamId}_`)) {
        delete conversationHistory[key];
      }
    });
    Object.keys(teamSessionState).forEach(key => {
      if (key.startsWith(`${teamId}_`)) {
        delete teamSessionState[key];
      }
    });
  }
}

// ==================== JSON Command Processing ====================
function parseJsonCommand(text) {
  try {
    // Try to find JSON block in markdown code block
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    
    // Try to find JSON object directly
    const jsonMatch = text.match(/\{[\s\S]*"command"[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Not valid JSON
  }
  return null;
}

async function executeJsonCommand(teamId, command, fromMemberId) {
  const team = teams[teamId];
  if (!team) return { error: 'Team not found' };
  
  // Ensure command.message is not undefined
  const safeCommand = {
    ...command,
    message: command.message || '',
    result: command.result || ''
  };
  
  switch (safeCommand.command) {
    case 'sendTo':
      const targetMember = team.members.find(m => m.name === safeCommand.target);
      if (targetMember) {
        await sendMessageToMember(teamId, targetMember.id, safeCommand.message);
        return { success: true, action: 'sent', target: safeCommand.target };
      }
      return { error: 'Target member not found' };
      
    case 'broadcast':
      await broadcastToTeam(teamId, safeCommand.message);
      return { success: true, action: 'broadcast' };
      
    case 'complete':
      ProgressManager.updateMemberStatus(teamId, fromMemberId, 'completed', {
        result: safeCommand.result
      });
      return { success: true, action: 'marked_complete' };
      
    default:
      return { error: 'Unknown command: ' + safeCommand.command };
  }
}

// ==================== Progress Management ====================
const ProgressManager = {
  initTeamProgress(teamId) {
    teamProgress[teamId] = {
      teamId,
      status: 'running',
      members: {},
      startTime: Date.now()
    };
  },
  
  updateMemberStatus(teamId, memberId, status, data = {}) {
    if (!teamProgress[teamId]) {
      this.initTeamProgress(teamId);
    }
    
    teamProgress[teamId].members[memberId] = {
      status,
      lastUpdate: Date.now(),
      ...data
    };
  },
  
  getTeamProgress(teamId) {
    return teamProgress[teamId];
  },
  
  interruptTeam(teamId) {
    if (teamProgress[teamId]) {
      teamProgress[teamId].status = 'interrupted';
      teamProgress[teamId].endTime = Date.now();
    }
  },
  
  resetTeamProgress(teamId) {
    delete teamProgress[teamId];
  }
};

// ==================== Message Handlers ====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = async () => {
    switch (msg.type) {
      // Team management
      case 'GET_TEAMS':
        return teams;
        
      case 'CREATE_TEAM':
        return createTeam(msg.teamData);
        
      case 'UPDATE_TEAM':
        return updateTeam(msg.teamId, msg.updates);
        
      case 'DELETE_TEAM':
        deleteTeam(msg.teamId);
        return { success: true };
        
      // Member management
      case 'ADD_MEMBER':
        return addMember(msg.teamId, msg.memberData);
        
      case 'UPDATE_MEMBER':
        return updateMember(msg.teamId, msg.memberId, msg.updates);
        
      case 'REMOVE_MEMBER':
        removeMember(msg.teamId, msg.memberId);
        return { success: true };
        
      // Messaging
      case 'SEND_TO_MEMBER':
        return await sendMessageToMember(msg.teamId, msg.memberId, msg.message, msg.options);
        
      case 'BROADCAST_TEAM':
        return await broadcastToTeam(msg.teamId, msg.message, msg.options);
        
      // Team session operations
      case 'START_TEAM_CHAT':
        const team = teams[msg.teamId];
        if (!team) {
          Logger.error('Team not found for START_TEAM_CHAT', { teamId: msg.teamId });
          return { error: 'Team not found' };
        }
        
        Logger.info('Starting team chat', {
          teamId: msg.teamId,
          teamName: team.name,
          memberCount: team.members.length,
          initialMessage: msg.initialMessage
        });
        
        ProgressManager.initTeamProgress(msg.teamId);
        
        // Create tabs for all members
        let createdCount = 0;
        for (const member of team.members) {
          if (!member.tabId) {
            Logger.info('Creating tab for member', { memberId: member.id, memberName: member.name });
            const tab = await createMemberTab(msg.teamId, member.id);
            if (tab) {
              createdCount++;
            }
          } else {
            Logger.info('Member already has tab', { memberId: member.id, tabId: member.tabId });
          }
        }
        
        Logger.info('Tab creation complete', { totalMembers: team.members.length, createdCount });
        
        // Wait for all tabs to load
        await sleep(3000);
        
        // Send initial message if provided
        Logger.info('Checking initial message', {
          teamId: msg.teamId,
          hasInitialMessage: !!msg.initialMessage,
          initialMessage: msg.initialMessage,
          initialMessageType: typeof msg.initialMessage
        });
        
        if (msg.initialMessage) {
          Logger.info('Sending initial message', { teamId: msg.teamId, message: msg.initialMessage });
          await broadcastToTeam(msg.teamId, msg.initialMessage);
        } else {
          Logger.warn('No initial message provided for START_TEAM_CHAT');
        }
        
        return {
          success: true,
          memberCount: team.members.length,
          tabsCreated: createdCount
        };
        
      case 'STOP_TEAM_CHAT':
        const stopTeam = teams[msg.teamId];
        if (stopTeam) {
          for (const member of stopTeam.members) {
            closeMemberTab(msg.teamId, member.id);
          }
        }
        // Clear session state
        clearConversationHistory(msg.teamId);
        ProgressManager.interruptTeam(msg.teamId);
        return { success: true };
        
      // Progress
      case 'GET_PROGRESS':
        return ProgressManager.getTeamProgress(msg.teamId);
        
      case 'INTERRUPT_TEAM':
        ProgressManager.interruptTeam(msg.teamId);
        return { success: true };
        
      case 'RESET_PROGRESS':
        ProgressManager.resetTeamProgress(msg.teamId);
        return { success: true };
        
      // Conversation history
      case 'GET_CONVERSATION_HISTORY':
        return {
          history: getConversationHistory(msg.teamId, msg.memberId),
          session: teamSessionState[`${msg.teamId}_${msg.memberId}`] || null
        };
        
      case 'GET_ALL_CONVERSATIONS':
        const teamConvos = {};
        const targetTeam = teams[msg.teamId];
        if (targetTeam && targetTeam.members) {
          targetTeam.members.forEach(member => {
            teamConvos[member.id] = {
              memberName: member.name,
              history: getConversationHistory(msg.teamId, member.id)
            };
          });
        }
        return teamConvos;
        
      case 'CLEAR_CONVERSATION_HISTORY':
        clearConversationHistory(msg.teamId, msg.memberId);
        return { success: true };
        
      // Logs
      case 'GET_LOGS':
        return teamLogs;
        
      case 'CLEAR_LOGS':
        teamLogs = [];
        await chrome.storage.local.set({ teamLogs: [] });
        return { success: true };
        
      // Data export/import
      case 'EXPORT_DATA':
        return {
          teams,
          logs: teamLogs,
          sessionState: teamSessionState,
          conversations: conversationHistory,
          exportTime: Date.now()
        };
        
      case 'IMPORT_DATA':
        if (msg.data.teams) {
          teams = msg.data.teams;
          saveTeams();
        }
        if (msg.data.logs) {
          teamLogs = msg.data.logs;
          await chrome.storage.local.set({ teamLogs });
        }
        if (msg.data.sessionState) {
          teamSessionState = msg.data.sessionState;
        }
        if (msg.data.conversations) {
          conversationHistory = msg.data.conversations;
        }
        return { success: true };
        
      // Content script messages
      case 'REPLY_RECEIVED':
        if (sender.tab) {
          const tabInfo = tabMemberMap[sender.tab.id];
          if (tabInfo) {
            const { teamId, memberId } = tabInfo;
            
            // 存储AI回复到对话历史
            const replyText = msg.payload?.text || '';
            storeMessage(teamId, memberId, 'assistant', replyText);
            
            // Parse JSON command from reply
            const command = parseJsonCommand(replyText);
            if (command) {
              Logger.info('JSON command detected', { teamId, memberId, command });
              
              const result = await executeJsonCommand(teamId, command, memberId);
              Logger.info('Command executed', { teamId, command, result });
              
              // After command execution, check if there's a next task in the queue
              if (result && result.success) {
                await processNextTask(teamId, memberId);
              }
            } else {
              // No command detected, check for task completion keywords
              if (isTaskCompletionDetected(replyText)) {
                await processNextTask(teamId, memberId);
              }
            }
            
            ProgressManager.updateMemberStatus(teamId, memberId, 'completed', {
              lastReply: replyText.substring(0, 200)
            });
          
            // Broadcast conversation update to all listening contexts
            chrome.runtime.sendMessage({
              type: 'CONVERSATION_UPDATED',
              teamId,
              memberId,
              message: {
                role: 'assistant',
                content: replyText,
                timestamp: Date.now()
              }
            }).catch(() => {});
          }
        }
        return { success: true };
        
      case 'GET_CONVERSATION_FROM_CONTENT':
        if (sender.tab) {
          const tabInfo = tabMemberMap[sender.tab.id];
          if (tabInfo) {
            const history = getConversationHistory(tabInfo.teamId, tabInfo.memberId);
            return { history };
          }
        }
        return { history: [] };
        
      case 'MESSAGE_SENT_FROM_CONTENT':
        if (sender.tab) {
          const tabInfo = tabMemberMap[sender.tab.id];
          if (tabInfo) {
            const { teamId, memberId } = tabInfo;
            
            // Broadcast that a message was sent
            chrome.runtime.sendMessage({
              type: 'CONVERSATION_UPDATED',
              teamId,
              memberId,
              message: {
                role: 'user',
                content: msg.payload?.text || '',
                timestamp: Date.now()
              }
            }).catch(() => {});
          }
        }
        return { success: true };
        
      default:
        return { error: 'Unknown message type: ' + msg.type };
    }
  };
  
  // Handle the message asynchronously
  const responsePromise = handle().then(result => {
    return result;
  }).catch(err => {
    Logger.error('Message handler error', { type: msg.type, error: err.message });
    return { error: err.message };
  });

  // Send response when ready
  responsePromise.then(result => {
    try {
      sendResponse(result);
    } catch (e) {
      // Channel already closed, ignore
      Logger.debug('Response channel closed', { type: msg.type });
    }
  });

  // Return true to indicate we'll respond asynchronously
  return true;
});


// ==================== Tab Cleanup ====================
chrome.tabs.onRemoved.addListener((tabId) => {
  const tabInfo = tabMemberMap[tabId];
  if (tabInfo) {
    const { teamId, memberId } = tabInfo;
    const team = teams[teamId];
    if (team) {
      const member = team.members.find(m => m.id === memberId);
      if (member) {
        member.tabId = null;
        saveTeams();
      }
    }
    delete tabMemberMap[tabId];
    if (teamTabs[teamId]) {
      delete teamTabs[teamId][memberId];
    }
    Logger.info('Tab closed', { tabId, teamId, memberId });
  }
});

// ==================== Initialization ====================
chrome.runtime.onStartup.addListener(() => {
  try {
    loadTeams();
    Logger.info('Service worker started');
  } catch (err) {
    console.error('Error in onStartup listener:', err);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  try {
    loadTeams();
    Logger.info('Extension installed/updated');
  } catch (err) {
    console.error('Error in onInstalled listener:', err);
  }
});

// Load data on startup
try {
  loadTeams();
} catch (err) {
  console.error('Error loading teams on startup:', err);
}

// ==================== Utils ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== Task Queue ====================
// Task queue management for teams
const taskQueues = {};
const taskAutoSend = {};

function addTaskToQueue(teamId, memberId, task) {
  const queueKey = `${teamId}_${memberId}`;
  if (!taskQueues[queueKey]) {
    taskQueues[queueKey] = [];
  }
  
  const taskItem = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    content: task,
    status: 'pending',
    createdAt: Date.now()
  };
  
  taskQueues[queueKey].push(taskItem);
  Logger.info('Task added to queue', { teamId, memberId, taskId: taskItem.id });
  return taskItem;
}

function getTaskQueue(teamId, memberId) {
  const queueKey = `${teamId}_${memberId}`;
  return taskQueues[queueKey] || [];
}

function removeTaskFromQueue(teamId, memberId, taskId) {
  const queueKey = `${teamId}_${memberId}`;
  if (taskQueues[queueKey]) {
    taskQueues[queueKey] = taskQueues[queueKey].filter(t => t.id !== taskId);
  }
}

function clearTaskQueue(teamId, memberId) {
  const queueKey = `${teamId}_${memberId}`;
  delete taskQueues[queueKey];
}

function setAutoSendEnabled(teamId, memberId, enabled) {
  const queueKey = `${teamId}_${memberId}`;
  taskAutoSend[queueKey] = enabled;
}

function isAutoSendEnabled(teamId, memberId) {
  const queueKey = `${teamId}_${memberId}`;
  return taskAutoSend[queueKey] !== false; // Default to true
}

async function processNextTask(teamId, memberId) {
  if (!isAutoSendEnabled(teamId, memberId)) {
    Logger.info('Auto-send disabled, skipping task processing', { teamId, memberId });
    return;
  }
  
  const queueKey = `${teamId}_${memberId}`;
  const queue = taskQueues[queueKey];
  
  if (!queue || queue.length === 0) {
    Logger.info('No tasks in queue', { teamId, memberId });
    return;
  }
  
  // Find the first pending task
  const pendingTaskIndex = queue.findIndex(t => t.status === 'pending');
  if (pendingTaskIndex === -1) {
    Logger.info('No pending tasks in queue', { teamId, memberId });
    return;
  }
  
  const task = queue[pendingTaskIndex];
  task.status = 'sending';
  
  try {
    Logger.info('Processing next task', { teamId, memberId, taskId: task.id });
    
    // Wait a moment before sending
    await sleep(2000);
    
    await sendMessageToMember(teamId, memberId, task.content);
    
    task.status = 'completed';
    task.completedAt = Date.now();
    
    // Move to completed section (optional: keep for history)
    Logger.info('Task completed and sent', { teamId, memberId, taskId: task.id });
    
    // Notify UI
    chrome.runtime.sendMessage({
      type: 'TASK_COMPLETED',
      teamId,
      memberId,
      task
    }).catch(() => {});
    
  } catch (err) {
    Logger.error('Failed to process task', { teamId, memberId, taskId: task.id, error: err.message });
    task.status = 'error';
    task.error = err.message;
  }
}

function isTaskCompletionDetected(replyText) {
  if (!replyText) return false;
  
  // Keywords that indicate task completion
  const completionKeywords = [
    '任务完成',
    '已完成',
    '任务已结束',
    'task completed',
    'task done',
    'finished',
    '完成',
    '结束任务',
    '工作完成',
    'finished the task',
    'completed successfully'
  ];
  
  const lowerText = replyText.toLowerCase();
  return completionKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}
