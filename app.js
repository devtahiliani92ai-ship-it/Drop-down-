/* Dropzone demo: client-side file manager. Files and settings are stored in this browser only. */
(() => {
  const $ = (id) => document.getElementById(id);
  const MAX_FILE = 100 * 1024 * 1024;
  const STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;
  const DB_KEY = "dropzone.files.v1";
  let files = [];
  let trash = [];
  let currentId = null;
  let zoom = 100;
  let activePage = "Dashboard";
  let searchTerm = "";
  let toastTimer;

  try { files = JSON.parse(localStorage.getItem(DB_KEY) || "[]"); } catch { files = []; }
  try { trash = JSON.parse(localStorage.getItem(DB_KEY + ".trash") || "[]"); } catch { trash = []; }
  files = files.map(f => ({...f, starred: !!f.starred, shared: !!f.shared}));
  const persist = () => {
    // Avoid filling localStorage with huge binary files; file contents are persisted only when small enough.
    localStorage.setItem(DB_KEY, JSON.stringify(files.map(f => ({...f, data: f.data && f.data.length < 2_000_000 ? f.data : null}))));
    localStorage.setItem(DB_KEY + ".trash", JSON.stringify(trash.map(f => ({...f, data: null}))));
  };
  const formatSize = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n/1024).toFixed(0)} KB` : n < 1073741824 ? `${(n/1048576).toFixed(1)} MB` : `${(n/1073741824).toFixed(2)} GB`;
  const dateLabel = d => new Date(d).toLocaleString([], {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const typeOf = f => {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (f.type?.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","bmp"].includes(ext)) return "Image";
    if (f.type === "application/pdf" || ext === "pdf") return "PDF";
    if (f.type?.startsWith("video/") || ["mp4","webm","mov"].includes(ext)) return "Video";
    if (["doc","docx","odt"].includes(ext)) return "DOCX";
    if (["txt","md","csv","json","html","css","js","xml"].includes(ext)) return "Text";
    return ext ? ext.toUpperCase() : "File";
  };
  const iconClass = f => { const t = typeOf(f); return t === "PDF" ? "file-pdf" : t === "Image" ? "file-image" : t === "Video" ? "file-video" : t === "DOCX" ? "file-doc" : "file-other"; };
  const iconText = f => { const t = typeOf(f); return t === "Image" ? "▧" : t === "PDF" ? "P" : t === "Video" ? "▶" : t === "DOCX" ? "W" : "▤"; };
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function safe(text) { return String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function currentFile() { return files.find(f => f.id === currentId); }
  function visibleFiles() {
    let arr = [...files];
    if (activePage === "Starred") arr = arr.filter(f => f.starred);
    if (activePage === "Shared with Me") arr = arr.filter(f => f.shared);
    if (activePage === "Trash") arr = [...trash];
    if (activePage === "Recent") arr.sort((a,b) => new Date(b.uploadedAt)-new Date(a.uploadedAt));
    if (searchTerm) arr = arr.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return arr;
  }
  function updateStats() {
    const bytes = files.reduce((sum,f)=>sum+(f.size||0),0);
    $("totalFiles").textContent = files.length;
    $("storageUsed").innerHTML = `${formatSize(bytes)} <small>/ 10 GB</small>`;
    $("recentUploads").textContent = files.filter(f => Date.now()-new Date(f.uploadedAt).getTime() < 7*86400000).length;
    $("sharedLinks").textContent = files.filter(f=>f.shared).length;
    const percent = Math.min(100, bytes / STORAGE_LIMIT * 100);
    $("storageProgress").style.width = percent + "%";
    $("sidebarProgress").style.width = percent + "%";
    $("sidebarStorage").textContent = `${formatSize(bytes)} of 10 GB used`;
  }
  function renderTable() {
    const arr = visibleFiles();
    $("fileTable").innerHTML = arr.map(f => `<tr data-id="${safe(f.id)}" title="Click to preview"><td><div class="file-cell"><span class="file-icon ${iconClass(f)}">${iconText(f)}</span><span>${safe(f.name)}${f.starred ? " ★" : ""}</span></div></td><td>${safe(typeOf(f))}</td><td>${formatSize(f.size||0)}</td><td>${safe(dateLabel(f.uploadedAt))}</td><td><span class="status">${activePage==="Trash"?"Deleted":f.shared?"Shared":"Uploaded"}</span></td><td><button class="more-btn" data-menu="${safe(f.id)}" title="File actions">⋯</button></td></tr>`).join("");
    $("emptyState").hidden = arr.length !== 0;
    $("fileTable").closest("table").hidden = arr.length === 0;
    $("listTitle").textContent = activePage === "Dashboard" ? "Recent files" : activePage;
    $("viewAllBtn").hidden = activePage !== "Dashboard";
    $("fileTable").querySelectorAll("tr[data-id]").forEach(row => row.addEventListener("click", e => {
      if (e.target.closest("[data-menu]")) { e.stopPropagation(); fileMenu(row.dataset.id); return; }
      const f = arr.find(x=>x.id===row.dataset.id); if(f && activePage!=="Trash") showPreview(f.id);
    }));
    $("emptyUploadBtn").onclick = () => $("fileInput").click();
  }
  function showPreview(id) {
    const f = files.find(x=>x.id===id); if (!f) return;
    currentId = id; zoom = 100; $("zoomValue").textContent = "100%";
    const stage = $("previewStage"); stage.innerHTML = "";
    const ext = (f.name.split(".").pop()||"").toLowerCase();
    if (f.data && (f.type?.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg","bmp"].includes(ext))) {
      const img = document.createElement("img"); img.src=f.data; img.alt=f.name; img.style.width=zoom+"%"; stage.appendChild(img);
    } else if (f.data && (f.type==="application/pdf" || ext==="pdf")) {
      const iframe = document.createElement("iframe"); iframe.src=f.data; iframe.title=f.name; stage.appendChild(iframe);
    } else if (f.data && (f.type?.startsWith("video/") || ["mp4","webm","mov"].includes(ext))) {
      const video=document.createElement("video"); video.controls=true; video.src=f.data; stage.appendChild(video);
    } else if (f.data && (f.type?.startsWith("text/") || ["txt","md","csv","json","html","css","js","xml"].includes(ext))) {
      const pre=document.createElement("pre"); try { pre.textContent=atob(f.data.split(",")[1]); } catch { pre.textContent="Preview unavailable for this file."; } stage.appendChild(pre);
    } else {
      stage.innerHTML=`<div class="preview-placeholder"><div class="placeholder-file">${iconText(f)}</div><b>${safe(f.name)}</b><p>${safe(typeOf(f))} · ${formatSize(f.size||0)}</p><p>Preview is unavailable for this format in this browser demo. You can still download the file.</p></div>`;
    }
    $("previewCount").textContent = `${Math.max(1,files.findIndex(x=>x.id===id)+1)} / ${files.length}`;
    $("previewMeta").hidden=false; $("previewMeta").textContent=`${f.name} · ${formatSize(f.size||0)} · ${typeOf(f)}`;
    renderTable();
  }
  function render() {
    const headings = {
      "Dashboard":["Your workspace","Upload, preview, and organize your files in one place."],
      "My Files":["My Files","All your uploaded files in one organized place."],
      "Shared with Me":["Shared with Me","Files you've marked as shared in this demo."],
      "Recent":["Recent files","Quickly return to files in your workspace."],
      "Starred":["Starred files","Your favorite files, all in one place."],
      "Trash":["Recently deleted","Restore files or permanently remove them."],
      "Settings":["Settings","Manage your workspace preferences."],
      "Help & Support":["Help & Support","Tips for using your file workspace."]
    };
    $("pageTitle").textContent=headings[activePage]?.[0]||activePage;
    $("pageSubtitle").textContent=headings[activePage]?.[1]||"Manage your workspace.";
    document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===activePage));
    $("stats").hidden=activePage!=="Dashboard";
    $("dashboardGrid").hidden=activePage==="Settings"||activePage==="Help & Support";
    $("secondaryPage").hidden=!(activePage==="Settings"||activePage==="Help & Support");
    if (activePage==="Settings") renderSettings();
    if (activePage==="Help & Support") renderHelp();
    updateStats(); renderTable();
    if (activePage==="Dashboard") $("listTitle").textContent="Recent files";
  }
  function renderSettings() {
    $("secondaryPage").innerHTML=`<h2>Workspace settings</h2><div class="setting-row"><div><b>Appearance</b><p>Switch between light and dark themes.</p></div><button class="secondary-btn" id="settingsTheme">Toggle theme</button></div><div class="setting-row"><div><b>Storage limit</b><p>Demo workspace capacity: 10 GB.</p></div><b>10 GB</b></div><div class="setting-row"><div><b>Local data</b><p>Demo files and preferences are saved in this browser only.</p></div><button class="secondary-btn" id="clearDemo">Clear demo data</button></div>`;
    $("settingsTheme").onclick=toggleTheme;
    $("clearDemo").onclick=()=>openDialog("Clear demo data",`<p>This permanently removes this demo's saved file list and trash from this browser.</p>`,()=>{files=[];trash=[];currentId=null;persist();render();showEmptyPreview();toast("Demo data cleared.");});
  }
  function renderHelp() {
    $("secondaryPage").innerHTML=`<h2>Help &amp; Support</h2><div class="setting-row"><div><b>Upload files</b><p>Drag files into the upload area or select Browse. Each file must be smaller than 100 MB.</p></div></div><div class="setting-row"><div><b>Preview</b><p>Select a file row to preview supported images, PDFs, text files and videos.</p></div></div><div class="setting-row"><div><b>Privacy note</b><p>This starter version stores file metadata in browser local storage. It is not cloud storage and does not provide real user authentication.</p></div></div>`;
  }
  function showEmptyPreview(){ $("previewStage").innerHTML=`<div class="preview-placeholder"><div class="placeholder-file">▤</div><b>Your preview appears here</b><p>Select a file from Recent files or upload one.</p></div>`;$("previewCount").textContent=`0 / ${files.length}`;$("previewMeta").hidden=true; }
  function toggleTheme(){document.body.classList.toggle("dark");localStorage.setItem("dropzone.dark",document.body.classList.contains("dark")?"1":"0");}
  function openDialog(title, html, onConfirm, confirmText="Continue") {
    $("dialogTitle").textContent=title; $("dialogBody").innerHTML=html; $("dialogConfirm").textContent=confirmText;
    const dialog=$("appDialog"); dialog.showModal();
    $("dialogForm").onsubmit=e=>{if(e.submitter?.value==="cancel")return; e.preventDefault(); const result=onConfirm?.(); if(result!==false)dialog.close();};
  }
  function fileMenu(id) {
    const f=files.find(x=>x.id===id) || trash.find(x=>x.id===id); if(!f)return;
    const inTrash=trash.some(x=>x.id===id);
    const options=inTrash?`<button class="secondary-btn" id="restoreFile">Restore file</button><button class="secondary-btn" id="permanentDelete">Delete permanently</button>`:`<button class="secondary-btn" id="renameFile">Rename</button><button class="secondary-btn" id="starFile">${f.starred?"Remove from starred":"Add to starred"}</button><button class="secondary-btn" id="shareFile">${f.shared?"Turn sharing off":"Mark as shared"}</button><button class="secondary-btn" id="downloadFile">Download</button><button class="secondary-btn" id="deleteFile">Move to trash</button>`;
    openDialog("File actions",`<p><b>${safe(f.name)}</b><br><span style="color:var(--muted)">${formatSize(f.size||0)} · ${safe(typeOf(f))}</span></p><div style="display:flex;flex-wrap:wrap;gap:8px">${options}</div>`,()=>false,"Done");
    const close=()=>{$("appDialog").close();};
    if(inTrash){
      $("restoreFile").onclick=()=>{trash=trash.filter(x=>x.id!==id);files.push(f);persist();close();render();toast("File restored.");};
      $("permanentDelete").onclick=()=>{trash=trash.filter(x=>x.id!==id);persist();close();render();toast("File permanently removed.");};
    } else {
      $("renameFile").onclick=()=>{close();openDialog("Rename file",`<label for="newName">File name</label><input id="newName" value="${safe(f.name)}" required>`,()=>{const v=$("newName").value.trim();if(!v)return false;f.name=v;persist();render();if(currentId===id)showPreview(id);toast("File renamed.");});};
      $("starFile").onclick=()=>{f.starred=!f.starred;persist();close();render();toast(f.starred?"Added to Starred.":"Removed from Starred.");};
      $("shareFile").onclick=()=>{f.shared=!f.shared;persist();close();render();toast(f.shared?"File marked as shared.":"Sharing turned off.");};
      $("downloadFile").onclick=()=>{download(f);close();};
      $("deleteFile").onclick=()=>{files=files.filter(x=>x.id!==id);trash.unshift(f);if(currentId===id){currentId=null;showEmptyPreview();}persist();close();render();toast("Moved to trash.");};
    }
  }
  function download(f) {
    if(!f)return;
    if(!f.data){toast("This file's contents weren't saved in the demo. Upload it again to download from this browser.");return;}
    const a=document.createElement("a");a.href=f.data;a.download=f.name;document.body.appendChild(a);a.click();a.remove();
  }
  function addFiles(fileList) {
    const list=[...fileList]; if(!list.length)return;
    let added=0;
    list.forEach(file=>{
      if(file.size>MAX_FILE){toast(`${file.name} is over the 100 MB limit.`);return;}
      const reader=new FileReader();
      reader.onload=()=>{
        const item={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),name:file.name,type:file.type,size:file.size,uploadedAt:new Date().toISOString(),data:reader.result,starred:false,shared:false};
        files.unshift(item);added++;persist();render();showPreview(item.id);
        if(added===list.length)toast(`${added} file${added===1?"":"s"} uploaded.`);
      };
      reader.onerror=()=>toast(`Couldn't read ${file.name}.`);
      reader.readAsDataURL(file);
    });
    $("fileInput").value="";
  }
  function createFolder() {
    openDialog("Create folder",`<label for="folderName">Folder name</label><input id="folderName" placeholder="e.g. College assignments" required>`,()=>{const name=$("folderName").value.trim();if(!name)return false;toast(`Folder “${name}” created for this session. Folder persistence is not enabled in this starter.`);});
  }
  function shareDialog() {
    const candidates=files.filter(f=>!f.shared);
    if(!files.length){toast("Upload a file first to share it.");return;}
    openDialog("Share files",`<label for="shareSelect">Choose a file</label><select id="shareSelect">${files.map(f=>`<option value="${safe(f.id)}">${safe(f.name)}</option>`).join("")}</select><label for="sharePermission">Permission</label><select id="sharePermission"><option>View only</option><option>Allow download</option></select><p style="font-size:12px;color:var(--muted)">Demo mode: this marks a file as shared locally. It does not create a public link.</p>`,()=>{const f=files.find(x=>x.id===$("shareSelect").value);if(f){f.shared=true;persist();render();toast("File marked as shared in this browser.");}});
  }
  $("navigation").addEventListener("click",e=>{const btn=e.target.closest("[data-page]");if(btn){activePage=btn.dataset.page;render();}});
  $("browseBtn").onclick=e=>{e.stopPropagation();$("fileInput").click();};
  $("dropzone").onclick=e=>{if(!e.target.closest("button"))$("fileInput").click();};
  $("dropzone").onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("fileInput").click();}};
  $("fileInput").addEventListener("change",e=>addFiles(e.target.files));
  ["dragenter","dragover"].forEach(evt=>$("dropzone").addEventListener(evt,e=>{e.preventDefault();$("dropzone").classList.add("dragover");}));
  ["dragleave","drop"].forEach(evt=>$("dropzone").addEventListener(evt,e=>{e.preventDefault();$("dropzone").classList.remove("dragover");}));
  $("dropzone").addEventListener("drop",e=>addFiles(e.dataTransfer.files));
  $("topUploadBtn").onclick=()=>$("fileInput").click();
  $("searchInput").addEventListener("input",e=>{searchTerm=e.target.value;renderTable();});
  $("viewAllBtn").onclick=()=>{activePage="My Files";render();};
  $("createFolder").onclick=createFolder;
  $("shareFiles").onclick=shareDialog;
  $("manageAccess").onclick=()=>{activePage="Shared with Me";render();};
  $("recentlyDeleted").onclick=()=>{activePage="Trash";render();};
  $("themeBtn").onclick=toggleTheme;
  $("profileBtn").onclick=()=>openDialog("Profile",`<p><b>Piyush Jangir</b></p><p style="color:var(--muted)">Demo workspace profile</p><label for="displayName">Display name</label><input id="displayName" value="Piyush Jangir">`,()=>{const name=$("displayName").value.trim();if(name){document.querySelector(".profile-name").textContent=name;toast("Profile name updated for this session.");}});
  $("notificationsBtn").onclick=()=>toast(files.length?`You have ${files.length} file${files.length===1?"":"s"} in your workspace.`:"No new notifications.");
  $("prevFile").onclick=()=>movePreview(-1); $("nextFile").onclick=()=>movePreview(1);
  function movePreview(dir){if(!files.length)return;let i=files.findIndex(f=>f.id===currentId);i=(i+dir+files.length)%files.length;showPreview(files[i].id);}
  $("zoomIn").onclick=()=>{zoom=Math.min(200,zoom+10);$("zoomValue").textContent=zoom+"%";const img=$("previewStage").querySelector("img");if(img)img.style.width=zoom+"%";};
  $("zoomOut").onclick=()=>{zoom=Math.max(30,zoom-10);$("zoomValue").textContent=zoom+"%";const img=$("previewStage").querySelector("img");if(img)img.style.width=zoom+"%";};
  $("downloadPreview").onclick=()=>download(currentFile());
  $("printPreview").onclick=()=>{const frame=$("previewStage").querySelector("iframe");if(frame){frame.contentWindow?.print();return;}const img=$("previewStage").querySelector("img");if(img){const w=window.open("");if(w){w.document.write(`<img src="${img.src}" style="max-width:100%">`);w.document.close();w.print();}}else toast("Print is available for PDF and image previews.");};
  $("expandPreview").onclick=()=>{const f=currentFile();if(!f){toast("Choose a file to preview first.");return;}openDialog("Instant preview",`<p><b>${safe(f.name)}</b></p><p>${safe(typeOf(f))} · ${formatSize(f.size||0)}</p><p>Use the preview panel to inspect supported files. Full-screen preview is available in the main panel.</p>`,()=>{},"Close");};
  $("recentlyDeleted").onclick=()=>{activePage="Trash";render();};
  if(localStorage.getItem("dropzone.dark")==="1")document.body.classList.add("dark");
  // Recover demo metadata. Binary data over 2 MB is deliberately not persisted.
  files=files.map(f=>({...f, data:f.data||null}));
  render(); if(files.length)showPreview(files[0].id); else showEmptyPreview();
})();