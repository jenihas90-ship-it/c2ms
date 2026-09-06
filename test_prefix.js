const blobs = [
    { pathname: 'cms_complaint_1_123.json', url: 'url1' },
    { pathname: 'cms_complaint_10_456.json', url: 'url2' },
    { pathname: 'cms_complaint_1_172.json', url: 'url3' }
];

const timestamp = 172; // The newly uploaded timestamp
// The prefix used in list() call
const prefix = `cms_complaint_1_`;

// list() in Vercel blob returns blobs where pathname.startsWith(prefix)
const listedBlobs = blobs.filter(b => b.pathname.startsWith(prefix));

console.log("Listed blobs:", listedBlobs);

// The deletion filter
const oldBlobs = listedBlobs.filter(b => !b.pathname.includes(`${timestamp}`));
console.log("Old blobs to delete:", oldBlobs);
