import React from 'react';

function Footer() {
  return (
    <footer className="bg-light text-center py-3 mt-5">
      <div>© {new Date().getFullYear()} Bin Masud Kuku. All rights reserved.</div>
    </footer>
  );
}

export default Footer;