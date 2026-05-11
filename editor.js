const socket = io('https://collab-docs-production-f233.up.railway.app')

let username = ''
let roomId = ''
let roomPassword = ''
let quill
let comments = []
let history = []
let cursorModule
let currentZoom = 100

const userColors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']

// FONTS & SIZES
const FontStyle = Quill.import('formats/font')
FontStyle.whitelist = ['arial','times','courier','georgia','verdana']
Quill.register(FontStyle, true)

const SizeStyle = Quill.import('attributors/style/size')
SizeStyle.whitelist = ['10px','12px','14px','16px','18px','24px','32px','48px']
Quill.register(SizeStyle, true)

Quill.register('modules/cursors', QuillCursors)

// JOIN
function joinApp() {
  const nameInput = document.getElementById('username-input')
  const roomInput = document.getElementById('room-input')
  const passInput = document.getElementById('password-input')
  username = nameInput.value.trim()
  roomId = roomInput.value.trim().toUpperCase()
  roomPassword = passInput.value.trim()
  if (!username) { alert('Veuillez entrer votre nom !'); return }
  if (!roomId) { alert('Veuillez entrer un code de salle !'); return }
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('app-screen').classList.add('visible')
  document.getElementById('room-info').textContent = roomId
  initEditor()
  socket.emit('user-join', { username, roomId, password: roomPassword })
}

// INIT EDITOR
function initEditor() {
  quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      cursors: true,
      history: { delay: 1000, maxStack: 100, userOnly: true },
      toolbar: [
        [{ font: ['arial','times','courier','georgia','verdana'] }],
        [{ size: ['10px','12px','14px','16px','18px','24px','32px','48px'] }],
        [{ header: [1,2,3,false] }],
        ['bold','italic','underline','strike'],
        [{ color: [] },{ background: [] }],
        [{ list: 'ordered' },{ list: 'bullet' }],
        [{ indent: '-1' },{ indent: '+1' }],
        [{ align: [] }],
        ['link','image'],
        ['clean']
      ]
    }
  })

  cursorModule = quill.getModule('cursors')

  socket.on('load-document', function(content) {
    if (content) quill.setContents(JSON.parse(content))
  })

  socket.on('receive-changes', function(content) {
    quill.setContents(JSON.parse(content))
  })

  socket.on('cursor-update', function(data) {
    if (data.userId === socket.id) return
    try {
      cursorModule.createCursor(data.userId, data.username, data.color)
      cursorModule.moveCursor(data.userId, data.range)
    } catch(e) {}
  })

  socket.on('cursor-remove', function(userId) {
    try { cursorModule.removeCursor(userId) } catch(e) {}
  })

  quill.on('text-change', function(delta, oldDelta, source) {
    if (source === 'user') {
      const content = JSON.stringify(quill.getContents())
      socket.emit('send-changes', { content, roomId })
      addHistoryEntry('✏️ Modification par ' + username)
    }
  })

  quill.on('selection-change', function(range, oldRange, source) {
    if (source === 'user' && range) {
      const myIndex = Object.values({}).length
      socket.emit('cursor-move', { roomId, username, range, color: userColors[myIndex % userColors.length] })
    }
  })

  // KEYBOARD SHORTCUTS
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey) {
      if (e.key === 'f') { e.preventDefault(); toggleSearch() }
      if (e.key === 's') { e.preventDefault(); saveAs('txt') }
      if (e.key === 'n') { e.preventDefault(); newDocument() }
      if (e.key === 'p') { e.preventDefault(); saveAs('pdf') }
      if (e.key === '=') { e.preventDefault(); zoomIn() }
      if (e.key === '-') { e.preventDefault(); zoomOut() }
      if (e.key === '0') { e.preventDefault(); zoomReset() }
      if (e.key === 'a') { if (document.activeElement === document.body) { e.preventDefault(); selectAll() } }
    }
  })
}

// WRONG PASSWORD
socket.on('wrong-password', function() {
  alert('Mot de passe incorrect !')
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('app-screen').classList.remove('visible')
})

// USERS
socket.on('update-users', function(users) {
  const bar = document.getElementById('users-bar')
  if (!bar) return
  bar.innerHTML = users.map(function(u, i) {
    const c = userColors[i % userColors.length]
    return '<span class="user-badge" style="background:' + c + '22;border:1px solid ' + c + '55;">' +
      '<span style="width:7px;height:7px;border-radius:50%;background:' + c + ';display:inline-block;"></span> ' + u + '</span>'
  }).join('')
})

// STATUS
socket.on('disconnect', function() {
  const dot = document.getElementById('status-dot')
  const txt = document.getElementById('status-text')
  if (dot) dot.style.background = '#ef4444'
  if (txt) txt.textContent = 'Deconnecte'
})
socket.on('connect', function() {
  const dot = document.getElementById('status-dot')
  const txt = document.getElementById('status-text')
  if (dot) dot.style.background = '#10b981'
  if (txt) txt.textContent = 'Connecte'
})

// NOTIFICATIONS
function showNotif(msg, color) {
  const c = document.getElementById('notif-container')
  const n = document.createElement('div')
  n.className = 'notif'
  n.style.background = color || 'rgba(26,31,46,0.97)'
  n.style.color = 'white'
  n.textContent = msg
  c.appendChild(n)
  setTimeout(function() {
    n.style.animation = 'slideOut 0.3s ease forwards'
    setTimeout(function() { n.remove() }, 300)
  }, 3000)
}

// MENUS
function toggleMenu(id) {
  document.querySelectorAll('.menu-dropdown').forEach(function(m) {
    if (m.id !== id) m.classList.remove('open')
  })
  document.getElementById(id).classList.toggle('open')
}
function closeMenu(id) { document.getElementById(id).classList.remove('open') }
document.addEventListener('click', function(e) {
  if (!e.target.closest('.menu-item')) {
    document.querySelectorAll('.menu-dropdown').forEach(function(m) { m.classList.remove('open') })
  }
  if (!e.target.closest('.dropdown')) {
    const sm = document.getElementById('save-menu')
    if (sm) sm.classList.remove('open')
  }
})

// SAVE
function toggleSaveMenu() { document.getElementById('save-menu').classList.toggle('open') }
function saveAs(format) {
  document.getElementById('save-menu').classList.remove('open')
  const filename = 'collab-docs-' + roomId
  const header = document.getElementById('header-input').value
  const footer = document.getElementById('footer-input').value
  const style = '<style>body{font-family:Arial;padding:40px;max-width:800px;margin:auto;line-height:1.6;}</style>'
  if (format === 'txt') {
    download(new Blob([quill.getText()], { type: 'text/plain;charset=utf-8' }), filename + '.txt')
  } else if (format === 'html') {
    const html = '<html><head><meta charset="UTF-8">' + style + '</head><body>' + (header ? '<h1>' + header + '</h1><hr>' : '') + quill.root.innerHTML + (footer ? '<hr><p style="text-align:center;color:#888;">' + footer + '</p>' : '') + '</body></html>'
    download(new Blob([html], { type: 'text/html;charset=utf-8' }), filename + '.html')
  } else if (format === 'pdf') {
    const win = window.open('', '_blank')
    win.document.write('<html><head><meta charset="UTF-8">' + style + '</head><body>' + (header ? '<h1>' + header + '</h1><hr>' : '') + quill.root.innerHTML + (footer ? '<hr><p style="text-align:center;color:#888;">' + footer + '</p>' : '') + '</body></html>')
    win.document.close(); win.print()
  }
  showNotif('Document enregistre !', 'rgba(16,185,129,0.95)')
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// NEW DOCUMENT
function newDocument() {
  if (confirm('Effacer le document actuel ?')) {
    quill.setContents([])
    socket.emit('send-changes', { content: JSON.stringify(quill.getContents()), roomId })
    addHistoryEntry('📄 Nouveau document par ' + username)
    showNotif('Nouveau document cree !', 'rgba(99,102,241,0.95)')
  }
}

// SELECT ALL
function selectAll() { quill.setSelection(0, quill.getLength()) }

// ZOOM
function zoomIn() { currentZoom = Math.min(200, currentZoom + 10); applyZoom() }
function zoomOut() { currentZoom = Math.max(50, currentZoom - 10); applyZoom() }
function zoomReset() { currentZoom = 100; applyZoom() }
function applyZoom() {
  document.getElementById('editor').style.transform = 'scale(' + (currentZoom/100) + ')'
  document.getElementById('editor').style.transformOrigin = 'top left'
  showNotif('Zoom: ' + currentZoom + '%', 'rgba(26,31,46,0.95)')
}

// INSERT HORIZONTAL LINE
function insertHorizontalLine() {
  const range = quill.getSelection(true)
  quill.insertText(range.index, '\n', 'user')
  quill.insertEmbed(range.index + 1, 'divider', true, 'user')
  showNotif('Ligne inseree !', 'rgba(99,102,241,0.95)')
}

// INSERT PAGE BREAK
function insertPageBreak() {
  const range = quill.getSelection(true)
  quill.insertText(range.index, '\n\n--- Saut de page ---\n\n', 'user')
  showNotif('Saut de page insere !', 'rgba(99,102,241,0.95)')
}

// SHOW SHORTCUTS
function showShortcuts() {
  alert('Raccourcis clavier:\n\nCtrl+S - Enregistrer\nCtrl+N - Nouveau document\nCtrl+P - Imprimer\nCtrl+F - Rechercher\nCtrl+Z - Annuler\nCtrl+Y - Refaire\nCtrl+A - Tout selectionner\nCtrl++ - Zoom +\nCtrl+- - Zoom -\nCtrl+0 - Zoom normal')
}

// TABLE
function openTableModal() { document.getElementById('table-modal').classList.add('open') }
function closeTableModal() { document.getElementById('table-modal').classList.remove('open') }
function insertTable() {
  const rows = parseInt(document.getElementById('table-rows').value) || 3
  const cols = parseInt(document.getElementById('table-cols').value) || 3
  const zone = document.getElementById('table-zone')
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'margin:10px 0; animation:fadeIn 0.3s ease;'
  const deleteBtn = document.createElement('button')
  deleteBtn.textContent = '🗑️ Supprimer ce tableau'
  deleteBtn.style.cssText = 'margin-bottom:6px; padding:5px 12px; background:rgba(239,68,68,0.8); color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px; transition:all 0.2s;'
  deleteBtn.onmouseenter = function() { this.style.background='rgba(239,68,68,1)'; this.style.transform='translateY(-1px)' }
  deleteBtn.onmouseleave = function() { this.style.background='rgba(239,68,68,0.8)'; this.style.transform='translateY(0)' }
  deleteBtn.onclick = function() { if (confirm('Supprimer ce tableau ?')) wrapper.remove() }
  const table = document.createElement('table')
  table.style.cssText = 'border-collapse:collapse; width:100%; background:#1a1f2e; border-radius:8px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.3);'
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr')
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement(r === 0 ? 'th' : 'td')
      cell.contentEditable = 'true'
      cell.style.cssText = 'padding:10px 14px; border:1px solid rgba(255,255,255,0.08); min-width:80px; outline:none; transition:background 0.2s;' + (r === 0 ? 'background:#6366f1; color:white; font-weight:600;' : 'color:#e2e8f0;')
      cell.textContent = r === 0 ? 'Colonne ' + (c + 1) : ''
      cell.onfocus = function() { if (r !== 0) this.style.background='rgba(99,102,241,0.1)' }
      cell.onblur = function() { this.style.background='' }
      tr.appendChild(cell)
    }
    table.appendChild(tr)
  }
  wrapper.appendChild(deleteBtn)
  wrapper.appendChild(table)
  zone.appendChild(wrapper)
  closeTableModal()
  showNotif('Tableau insere !', 'rgba(59,130,246,0.95)')
}

// SEARCH
function toggleSearch() {
  const bar = document.getElementById('search-bar')
  bar.style.display = bar.style.display === 'none' ? 'flex' : 'none'
  if (bar.style.display === 'flex') document.getElementById('search-input').focus()
}
function searchText() {
  const term = document.getElementById('search-input').value
  const text = quill.getText()
  const index = text.indexOf(term)
  const result = document.getElementById('search-result')
  if (index !== -1) {
    quill.setSelection(index, term.length)
    result.textContent = '✓ Trouve !'
    result.style.color = '#10b981'
  } else {
    result.textContent = '✗ Non trouve'
    result.style.color = '#ef4444'
  }
}
function replaceText() {
  const term = document.getElementById('search-input').value
  const replacement = document.getElementById('replace-input').value
  const text = quill.getText()
  const index = text.indexOf(term)
  if (index !== -1) {
    quill.deleteText(index, term.length)
    quill.insertText(index, replacement)
    document.getElementById('search-result').textContent = '✓ Remplace !'
    document.getElementById('search-result').style.color = '#10b981'
    showNotif('Remplace !', 'rgba(139,92,246,0.95)')
  }
}

// HEADER FOOTER
function toggleHeaderFooter() {
  const bar = document.getElementById('header-footer-bar')
  bar.style.display = bar.style.display === 'none' ? 'flex' : 'none'
}
function updateHeader() {
  const val = document.getElementById('header-input').value
  const d = document.getElementById('header-display')
  d.style.display = val ? 'block' : 'none'
  d.textContent = val
}
function updateFooter() {
  const val = document.getElementById('footer-input').value
  const d = document.getElementById('footer-display')
  d.style.display = val ? 'block' : 'none'
  d.textContent = val
}

// COMMENTS
function openCommentModal() { document.getElementById('comment-modal').classList.add('open'); document.getElementById('comment-text').value = '' }
function closeCommentModal() { document.getElementById('comment-modal').classList.remove('open') }
function addComment() {
  const text = document.getElementById('comment-text').value.trim()
  if (!text) { alert('Ecrivez un commentaire !'); return }
  const comment = { author: username, text, time: new Date().toLocaleTimeString() }
  socket.emit('new-comment', { comment, roomId })
  closeCommentModal()
  showNotif('Commentaire ajoute !', 'rgba(249,115,22,0.95)')
}
socket.on('load-comments', function(roomComments) { comments = roomComments || []; renderComments() })
socket.on('receive-comment', function(comment) {
  comments.push(comment); renderComments()
  if (comment.author !== username) showNotif(comment.author + ' a commente', 'rgba(249,115,22,0.95)')
})
function renderComments() {
  const list = document.getElementById('comments-list')
  if (!list) return
  list.innerHTML = comments.map(function(c) {
    return '<div class="comment-item"><div class="comment-author">👤 ' + c.author + ' · ' + c.time + '</div><div class="comment-text">' + c.text + '</div></div>'
  }).join('')
}

// HISTORY
function toggleHistory() { document.getElementById('history-panel').classList.toggle('open') }
function addHistoryEntry(msg) {
  history.unshift({ msg, time: new Date().toLocaleTimeString() })
  if (history.length > 100) history.pop()
  renderHistory()
}
function renderHistory() {
  const list = document.getElementById('history-list')
  if (!list) return
  list.innerHTML = history.map(function(h) {
    return '<div class="history-item"><div class="history-time">🕐 ' + h.time + '</div>' + h.msg + '</div>'
  }).join('')
}
socket.on('user-notification', function(msg) { addHistoryEntry('👥 ' + msg); showNotif(msg, 'rgba(99,102,241,0.95)') })

// CHAT
function toggleChat() { document.getElementById('chat-panel').classList.toggle('open') }
function sendChat() {
  const input = document.getElementById('chat-input')
  const msg = input.value.trim()
  if (!msg) return
  socket.emit('chat-message', { username, msg, roomId })
  input.value = ''
}
socket.on('receive-chat', function(data) {
  const messages = document.getElementById('chat-messages')
  const div = document.createElement('div')
  div.className = 'chat-msg ' + (data.username === username ? 'me' : 'other')
  div.innerHTML = '<div class="msg-name">' + data.username + '</div>' + data.msg
  messages.appendChild(div)
  messages.scrollTop = messages.scrollHeight
  if (data.username !== username) showNotif(data.username + ': ' + data.msg, 'rgba(239,68,68,0.95)')
})