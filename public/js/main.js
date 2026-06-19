// Global compare state
var compareList = [];

function toggleCompare(id) {
  var idx = compareList.indexOf(id);
  if (idx > -1) compareList.splice(idx, 1);
  else {
    if (compareList.length >= 4) { alert('Max 4 devices'); return; }
    compareList.push(id);
  }
  document.querySelectorAll('.btn-compare').forEach(function(btn) {
    var bid = parseInt(btn.getAttribute('data-id'));
    if (bid === id) {
      btn.textContent = compareList.indexOf(id) > -1 ? '✓ Added' : 'Compare';
      btn.classList.toggle('btn-primary');
      btn.classList.toggle('btn-secondary');
    }
  });
}

function goCompare() {
  if (compareList.length < 2) { alert('Select at least 2'); return; }
  window.location.href = '/compare?ids=' + compareList.join(',');
}

// Search
var searchTimeout;
document.getElementById('navSearch').addEventListener('input', function(e) {
  clearTimeout(searchTimeout);
  var q = e.target.value.trim();
  if (q.length < 2) { document.getElementById('searchDropdown').classList.remove('active'); return; }
  searchTimeout = setTimeout(function() {
    fetch('/api/devices?search=' + encodeURIComponent(q))
      .then(r => r.json())
      .then(function(data) {
        var dd = document.getElementById('searchDropdown');
        if (data.length === 0) { dd.classList.remove('active'); return; }
        dd.innerHTML = data.slice(0, 8).map(function(d) {
          return '<div class="search-item" onclick="window.location.href=\'/device/' + d.id + '\'">' +
            (d.image ? '<img src="' + d.image + '" alt="">' : '<div class="no-image" style="width:40px;height:40px;font-size:1rem;">' + d.name.charAt(0) + '</div>') +
            '<div class="search-item-info"><div class="search-item-brand">' + d.brand + '</div><div class="search-item-name">' + d.name + '</div></div>' +
            '<div class="search-item-price">$' + d.price.toLocaleString() + '</div></div>';
        }).join('');
        dd.classList.add('active');
      });
  }, 200);
});

document.getElementById('navSearchBtn').addEventListener('click', function() {
  var q = document.getElementById('navSearch').value.trim();
  if (q) window.location.href = '/products?search=' + encodeURIComponent(q);
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-box')) document.getElementById('searchDropdown').classList.remove('active');
});

document.addEventListener('DOMContentLoaded', function() {
  var url = new URL(window.location.href);
  if (url.searchParams.has('ids')) {
    compareList = url.searchParams.get('ids').split(',').map(Number).filter(Boolean);
  }
});
