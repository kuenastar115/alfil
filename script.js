const CSV_TXT_URL = 'https://raw.githubusercontent.com/kuenastar115/scbd/main/src/csvs.txt';

function slugify(title) {
  return title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
}

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, words) {
  let escapedWords = words.map(w => escapeRegExp(w));
  const pattern = new RegExp(`(${escapedWords.join('|')})`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}

async function loadAllCSVs() {
  try {
    const txtRes = await fetch(CSV_TXT_URL);
    const txtContent = await txtRes.text();
    const csvUrls = txtContent.split('\n').map(line => line.trim()).filter(Boolean);
    const texts = await Promise.all(csvUrls.map(url => fetch(url).then(res => res.text())));
    return texts.flatMap(text => Papa.parse(text, { header: true, skipEmptyLines: true }).data);
  } catch (err) {
    console.error("Failed to load CSVs:", err);
    return [];
  }
}

// Attach global search form
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('searchForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = document.getElementById('searchInput').value.trim();
      if (input) {
        const query = input.toLowerCase().replace(/\s+/g, '-');
        const baseUrl = window.location.origin + window.location.pathname;
        window.location.href = `${baseUrl}?view=search&query=${query}`;
      }
    });
  }

  routeView(); // initialize view on load
});

async function routeView() {
  const view = getQueryParam('view') || 'index';
  const container = document.getElementById('main-content');
  const data = await loadAllCSVs();
  const baseUrl = window.location.origin + window.location.pathname;

  if (view === 'index') {
    const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 10);
    const items = shuffled.map(d => {
      const slug = slugify(d.Title);
      return `
        <div class="related-post">
          <div class="related-post-title">
            <a href="?view=pdf&id=${d.ID}&slug=${slug}">${d.Title}</a>
          </div>
          <div class="related-post-text">${d.Summary}</div>
          <hr class="post-divider">
        </div>
      `;
    }).join('');
    container.innerHTML = `
      <h1>Thousands of English Resources for Teaching and Learning Activities</h1>
      <hr class="post-divider">
      <div>${items}</div>
    `;

  } else if (view === 'search') {
    const query = getQueryParam('query');
    const page = parseInt(getQueryParam('page')) || 1;
    const RESULTS_PER_PAGE = 10;
    const queryWords = query ? query.toLowerCase().split('-').filter(Boolean) : [];

    if (!query || queryWords.length === 0) {
      container.innerHTML = "<h1>Please enter a search query.</h1>";
      return;
    }

    const matches = data.map(d => {
      const title = d.Title.toLowerCase();
      const summary = d.Summary.toLowerCase();
      const fullQuery = queryWords.join(' ');
      let relevance = 0;
      if (slugify(d.Title) === query) relevance = 100;
      else if (title.includes(fullQuery)) relevance = 75;
      else if (queryWords.some(q => title.includes(q))) relevance = 50;
      else if (queryWords.some(q => summary.includes(q))) relevance = 25;
      return { ...d, relevance };
    }).filter(d => d.relevance > 0).sort((a, b) => b.relevance - a.relevance);

    const totalPages = Math.ceil(matches.length / RESULTS_PER_PAGE);
    const startIndex = (page - 1) * RESULTS_PER_PAGE;
    const pageResults = matches.slice(startIndex, startIndex + RESULTS_PER_PAGE);

    const output = pageResults.map(d => {
      const slug = slugify(d.Title);
      return `
        <div class="related-post">
          <div class="related-post-title">
            <a href="?view=pdf&id=${d.ID}&slug=${slug}">${highlight(d.Title, queryWords)}</a>
          </div>
          <div class="related-post-text">${highlight(d.Summary, queryWords)}</div>
          <hr class="post-divider">
        </div>
      `;
    }).join('');

    const pagination = generatePagination(query, page, totalPages);
    container.innerHTML = `
      <h1>${matches.length} result(s) found for '${query.replace(/-/g, ' ')}'</h1>
      ${output}
      ${pagination}
    `;
  } else if (view === 'pdf') {
    const id = getQueryParam('id');
    const slug = getQueryParam('slug');
    const doc = data.find(d => d.ID.trim() === id && slugify(d.Title) === slug);

    if (!doc) {
      container.innerHTML = `<p>Error: Document not found.</p>`;
      return;
    }

    const relatedDocs = data.filter(d => d.ID !== doc.ID).sort(() => 0.5 - Math.random()).slice(0, 6);
    const suggestions = relatedDocs.map(d => {
      const slug = slugify(d.Title);
      return `
        <div class="related-post">
          <div class="related-post-title">
            <a href="?view=pdf&id=${d.ID}&slug=${slug}">${d.Title}</a>
          </div>
          <div class="related-post-text">${d.Summary}</div>
          <hr class="post-divider">
        </div>
      `;
    }).join('');

    document.title = `[PDF] ${doc.Title} | English Resources`;

    container.innerHTML = `
      <div id="breadcrumb" class="breadcrumb"><a href="?view=index">Home</a> &raquo; ${doc.Title}</div>
      <div id="title-section"><h1>${doc.Title}</h1></div>
      <hr class="post-divider">
      <div id="description-section">
        <p class="description">${doc.Summary}</p>
        <p class="description"><strong>${doc.Title}</strong> contains ${doc.Pages} pages, uploaded by SCRB Downloader Team. Downloaded ${doc.Views} times.</p>
        <a class="download-button" href="https://scribd.vdownloaders.com/document/${doc.ID}/${slug}" target="_blank"><span style="font-size: 20px;">DOWNLOAD PDF</span></a>
      </div>
      <div id="iframe-section">
        <iframe class="scribd_iframe_embed"
          title="${doc.Title}"
          src="https://www.scribd.com/embeds/${doc.ID}/content?start_page=1&view_mode=scroll&access_key=key-NCzuA9v6DY7zHHNCjjID"
          width="100%" height="800" frameborder="0" scrolling="no">
        </iframe>
      </div>
      <div id="suggestion-section">
        <h2>Documents related to ${doc.Title}</h2>
        ${suggestions}
      </div>
    `;
  } else {
    container.innerHTML = `<h1>Error: Unknown view '${view}'</h1>`;
  }
}

function generatePagination(query, currentPage, totalPages) {
  if (totalPages <= 1) return '';
  let html = '<div class="pagination">';
  if (currentPage > 1) {
    html += `<a href="?view=search&query=${query}&page=${currentPage - 1}">Prev</a>`;
  }

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(`<a href="?view=search&query=${query}&page=${i}" ${i === currentPage ? 'class="active"' : ''}>${i}</a>`);
  }
  html += pages.join('');
  if (currentPage < totalPages) {
    html += `<a href="?view=search&query=${query}&page=${currentPage + 1}">Next</a>`;
  }
  html += '</div>';
  return html;
}
