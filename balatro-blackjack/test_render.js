import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App.jsx';

try {
  // We can't render App easily because it imports CSS and other assets.
  // We'll have to compile it or stub CSS.
} catch (e) {
  console.error(e);
}
