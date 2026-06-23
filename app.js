const state = { jobs: [], feed: null, filter: 'all', query: '', source: '', sort: 'score', favorites: new Set(JSON.parse(localStorage.getItem('horlojobs-favorites') || '[]')), map: null, markers: null };
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) { const node = document.createElement('span'); node.textContent = value || ''; return node.innerHTML; }
function saveFavorites() { localStorage.setItem('horlojobs-favorites', JSON.stringify([...state.favorites])); }
function readableDate(value) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'mise à jour récente' : `mis à jour le ${date.toLocaleDateString('fr-FR', { day:'2-digit', month:'long' })} à ${date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}`; }
function jobMatches(job) { const query = state.query.toLocaleLowerCase('fr'); const text = [job.title, job.company, job.location, job.source, job.reason].join(' ').toLocaleLowerCase('fr'); return (!query || text.includes(query)) && (!state.source || job.source === state.source) && (state.filter !== 'new' || job.isNew) && (state.filter !== 'favorites' || state.favorites.has(job.id)); }
function orderedJobs() { return state.jobs.filter(jobMatches).sort((a,b) => { if (state.sort === 'new') return Number(b.isNew) - Number(a.isNew) || b.score - a.score; if (state.sort === 'company') return a.company.localeCompare(b.company, 'fr'); return b.score - a.score; }); }

function renderMap(jobs) {
  const points = jobs.filter((job) => Number.isFinite(Number(job.coordinates?.lat)) && Number.isFinite(Number(job.coordinates?.lon)));
  $('#map-summary').textContent = `${points.length} emplacement${points.length > 1 ? 's' : ''} affiché${points.length > 1 ? 's' : ''}`;
  $('#map-notice').textContent = state.feed?.mapNotice || 'Les positions sont calculées à partir des lieux publics des annonces.';
  if (!window.L) { $('#map').textContent = 'La carte ne peut pas être chargée pour le moment.'; return; }
  if (!state.map) { state.map = L.map('map', { scrollWheelZoom: false }).setView([46.6, 2.4], 5); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(state.map); state.markers = L.featureGroup().addTo(state.map); }
  state.markers.clearLayers();
  const bounds = [];
  points.forEach((job) => {
    const lat = Number(job.coordinates.lat); const lon = Number(job.coordinates.lon); const marker = L.circleMarker([lat, lon], { radius: 8, color: '#ffffff', weight: 2, fillColor: job.isNew ? '#087443' : '#075985', fillOpacity: 1 });
    const popup = document.createElement('div'); popup.className = 'map-popup'; popup.innerHTML = `<strong>${escapeHtml(job.title)}</strong><span>${escapeHtml(job.company)} · ${escapeHtml(job.location || job.countryLabel)}</span>`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Voir la fiche'; button.addEventListener('click', () => { state.map.closePopup(); showDetails(job); }); popup.append(button);
    marker.bindPopup(popup).addTo(state.markers); bounds.push([lat, lon]);
  });
  if (bounds.length === 1) state.map.setView(bounds[0], 9); else if (bounds.length > 1) state.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 9 }); else state.map.setView([46.6, 2.4], 5);
  setTimeout(() => state.map.invalidateSize(), 0);
}

function render() {
  const jobs = orderedJobs(); const list = $('#job-list'); list.replaceChildren();
  $('#result-count').textContent = `${jobs.length} offre${jobs.length > 1 ? 's' : ''} affichée${jobs.length > 1 ? 's' : ''}`;
  $('#empty-state').hidden = jobs.length !== 0;
  const template = $('#job-card-template');
  jobs.forEach((job) => {
    const node = template.content.cloneNode(true); const card = node.querySelector('.job-card'); card.classList.toggle('is-new', job.isNew); node.querySelector('.score').textContent = `${job.score}/100`; node.querySelector('.new-badge').hidden = !job.isNew; node.querySelector('.source-badge').textContent = job.source; node.querySelector('.title').textContent = job.title; node.querySelector('.company').textContent = job.company; node.querySelector('.location').textContent = job.location || 'Lieu à confirmer'; node.querySelector('.salary-mid').textContent = `Salaire moyen : ${job.salaryEstimate?.label || 'à estimer'}`; node.querySelector('.reason').textContent = job.reason || 'Correspondance avec ton profil horloger.';
    const favorite = node.querySelector('.favorite'); const saved = state.favorites.has(job.id); favorite.classList.toggle('saved', saved); favorite.textContent = saved ? '♥' : '♡'; favorite.setAttribute('aria-label', saved ? 'Retirer des favoris' : 'Ajouter aux favoris'); favorite.addEventListener('click', () => { saved ? state.favorites.delete(job.id) : state.favorites.add(job.id); saveFavorites(); render(); });
    node.querySelector('.details').addEventListener('click', () => showDetails(job)); node.querySelector('.letter').addEventListener('click', () => showDetails(job, true)); const open = node.querySelector('.open'); open.href = job.url; list.append(node);
  });
  $('#favorite-count').textContent = state.favorites.size; renderMap(jobs);
}

function showDetails(job, openLetter = false) {
  const detail = $('#job-detail'); const mailSubject = encodeURIComponent(`Candidature — ${job.title}`); const letter = job.coverLetter || {}; const letterHtml = letter.body ? `<details class="letter-box" ${openLetter ? 'open' : ''}><summary>Préparer la lettre pour ${escapeHtml(letter.targetCompany || job.company)}</summary>${letter.note ? `<p>${escapeHtml(letter.note)}</p>` : ''}<pre>${escapeHtml(letter.body)}</pre><button class="copy-letter" type="button">Copier la lettre</button></details>` : '';
  detail.innerHTML = `<h2 class="detail-title">${escapeHtml(job.title)}</h2><p class="detail-company">${escapeHtml(job.company)}</p><div class="detail-meta"><span>Score ${job.score}/100</span>${job.isNew ? '<span>Nouvelle offre</span>' : ''}${job.location ? `<span>⌖ ${escapeHtml(job.location)}, ${escapeHtml(job.countryLabel || '')}</span>` : ''}${job.contract ? `<span>${escapeHtml(job.contract)}</span>` : ''}</div><section class="detail-section"><h3>Salaire moyen estimé</h3><p><strong>${escapeHtml(job.salaryEstimate?.label || 'À estimer')}</strong>${job.salaryEstimate?.secondary ? `<br>${escapeHtml(job.salaryEstimate.secondary)}` : ''}<br>${escapeHtml(job.salaryEstimate?.net || '')}<br><small>${escapeHtml(job.salaryEstimate?.kind || '')}</small></p></section><section class="detail-section"><h3>Pourquoi cette offre correspond</h3><p>${escapeHtml(job.reason || 'Correspondance avec tes compétences horlogères.')}</p></section>${job.matchedSkills ? `<section class="detail-section"><h3>Compétences détectées</h3><p>${escapeHtml(job.matchedSkills)}</p></section>` : ''}${job.description ? `<section class="detail-section"><h3>Description</h3><p>${escapeHtml(job.description)}</p></section>` : ''}${letterHtml}<div class="detail-actions"><a href="${escapeHtml(job.url)}" target="_blank" rel="noopener">Ouvrir l’annonce</a><a href="mailto:?subject=${mailSubject}">Préparer l’e-mail</a></div>`;
  const copy = detail.querySelector('.copy-letter'); if (copy) copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(letter.body); copy.textContent = 'Lettre copiée'; } catch { copy.textContent = 'Copie manuelle nécessaire'; } });
  $('#job-dialog').showModal();
}

function renderSources() { const list = $('#source-list'); list.replaceChildren(); (state.feed.sourceStatuses || []).forEach((source) => { const item = document.createElement('li'); item.textContent = `${source.source} : ${source.collected} offre(s) — ${source.state}`; list.append(item); }); }
function setupFilters() { $('#search').addEventListener('input', (event) => { state.query = event.target.value.trim(); render(); }); $('#source-filter').addEventListener('change', (event) => { state.source = event.target.value; render(); }); $('#sort').addEventListener('change', (event) => { state.sort = event.target.value; render(); }); document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button)); render(); })); $('#close-dialog').addEventListener('click', () => $('#job-dialog').close()); $('#job-dialog').addEventListener('click', (event) => { if (event.target === $('#job-dialog')) $('#job-dialog').close(); }); $('#refresh-button').addEventListener('click', loadFeed); }
async function loadFeed() { const refresh = $('#refresh-button'); refresh.disabled = true; refresh.textContent = '…'; try { const response = await fetch(`data/jobs.json?updated=${Date.now()}`, { cache: 'no-store' }); if (!response.ok) throw new Error('Rapport indisponible'); state.feed = await response.json(); state.jobs = state.feed.jobs || []; $('#total-offers').textContent = state.feed.summary?.offers ?? state.jobs.length; $('#new-offers').textContent = state.feed.summary?.newOffers ?? 0; $('#last-update').textContent = readableDate(state.feed.generatedAt); const select = $('#source-filter'); const selected = state.source; select.replaceChildren(new Option('Toutes les sources', '')); [...new Set(state.jobs.map((job) => job.source))].sort((a,b) => a.localeCompare(b, 'fr')).forEach((source) => select.add(new Option(source, source))); select.value = selected; renderSources(); render(); } catch (error) { $('#last-update').textContent = 'Le rapport sera disponible après la prochaine recherche.'; $('#result-count').textContent = 'Impossible de charger les offres pour le moment.'; console.error(error); } finally { refresh.disabled = false; refresh.textContent = '↻'; } }
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
setupFilters(); loadFeed();
