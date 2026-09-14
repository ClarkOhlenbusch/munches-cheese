import { list } from '@vercel/blob';

async function getSummary() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const { blobs } = await list({ prefix: 'data/summary.json', token });
    if (blobs.length > 0 && (blobs[0].downloadUrl || blobs[0].url)) {
      const fetchUrl = blobs[0].downloadUrl || blobs[0].url;
      const res = await fetch(`${fetchUrl}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        return await res.json();
      }
    }
  } catch (err) {
    console.error('Error fetching summary blob:', err);
  }
  return {
    totalCount: 0,
    signups: [],
    demandVotes: [],
    storeStats: {},
    flavorStats: {},
    lastUpdated: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check authentication
  const rawExpected = process.env.ADMIN_PASSWORD || 'munches2026';
  const expectedPassword = rawExpected.replace(/^["'\s]+|["'\s]+$/g, '');
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const rawProvided = 
    url.searchParams.get('password') || 
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.headers['x-admin-password'] || '';
  const providedPassword = rawProvided.replace(/^["'\s]+|["'\s]+$/g, '');

  if (providedPassword !== expectedPassword) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid admin password' 
    });
  }

  try {
    const action = url.searchParams.get('action');

    // Reset test data if requested
    if (req.method === 'POST' && action === 'reset_test_data') {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const emptySummary = {
        totalCount: 0,
        signups: [],
        demandVotes: [],
        storeStats: {},
        flavorStats: {},
        lastUpdated: new Date().toISOString()
      };
      const { put } = await import('@vercel/blob');
      await put('data/summary.json', JSON.stringify(emptySummary), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        token
      });
      return res.status(200).json({ success: true, message: 'All test data has been reset to 0.' });
    }

    const summary = await getSummary();
    const signups = (summary.signups || []).slice().reverse(); // newest first
    const demandVotes = (summary.demandVotes || []).slice().reverse();

    const format = url.searchParams.get('format');

    // CSV Export Handler
    if (format === 'csv') {
      const type = url.searchParams.get('type') || 'all';
      let csv = 'Ticket,Type,Name,Email,Zip/City,Store,Flavor,Timestamp\n';

      if (type === 'all' || type === 'waitlist') {
        signups.forEach((s) => {
          csv += `"${s.ticketNumber || ''}","waitlist","${(s.name || '').replace(/"/g, '""')}","${(s.email || '').replace(/"/g, '""')}","${(s.zip || '').replace(/"/g, '""')}","${(s.store || '').replace(/"/g, '""')}","${(s.flavor || '').replace(/"/g, '""')}","${s.timestamp || ''}"\n`;
        });
      }

      if (type === 'all' || type === 'demand') {
        demandVotes.forEach((d) => {
          csv += `"","store_demand","Community","","${(d.zip || '').replace(/"/g, '""')}","${(d.store || '').replace(/"/g, '""')}","","${d.timestamp || ''}"\n`;
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="munches-leads-${dateStr}.csv"`);
      return res.status(200).send(csv);
    }

    // Top ZIPs calculation
    const zipMap = {};
    [...signups, ...demandVotes].forEach((entry) => {
      const z = (entry.zip || 'Unknown').trim();
      if (z) zipMap[z] = (zipMap[z] || 0) + 1;
    });
    const zipLeaderboard = Object.entries(zipMap)
      .map(([zip, count]) => ({ zip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.status(200).json({
      success: true,
      totalCount: summary.totalCount || signups.length,
      waitlistCount: signups.length,
      demandCount: demandVotes.length,
      lastUpdated: summary.lastUpdated,
      storeStats: summary.storeStats || {},
      flavorStats: summary.flavorStats || {},
      zipLeaderboard,
      signups,
      demandVotes
    });
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
