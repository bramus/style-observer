
import CSSStyleObserver from '../../src/index.js';

const cssStyleObserver = new CSSStyleObserver(['--variable1', '--variable2', 'display', 'border-width'],
	(variables) => {
		document.querySelector('#result')!.textContent = Object.entries(variables).map(value => `${value[0]} = ${value[1]}`).join('\n');
	});
cssStyleObserver.attach(document.body);

declare global {
	interface Window {
		toggleDisplay: () => void;
		toggleBorder: () => void;
		randomValue: (propertyName: string) => void;
		randomString: (propertyName: string) => void;
		toggleBodyClass: (propertyName: string) => void;
		detachObserver: () => void;
		attachObserver: () => void;
	}
}

window.toggleDisplay = () => {
  if (getComputedStyle(document.body).getPropertyValue('display') == 'block') {
	document.body.style.setProperty('display', 'inline-block');
  } else {
	document.body.style.setProperty('display', 'block');
  }
}
window.toggleBorder = () => {
  console.log('toggleBorder');
  console.log(getComputedStyle(document.body).getPropertyValue('border-width'));
  if (getComputedStyle(document.body).getPropertyValue('border-width') === '1px') {
	document.body.style.setProperty('border-width', '10px');
  } else {
	document.body.style.setProperty('border-width', '1px');
  }
}
window.randomValue = (variable) => document.documentElement.style.setProperty(variable, '' + Math.random());
window.randomString = (variable) => document.documentElement.style.setProperty(variable, window.crypto.randomUUID());
window.toggleBodyClass = (className) => document.body.classList.toggle(className);
window.detachObserver = () => { cssStyleObserver.detach(); document.querySelector('#result')!.textContent = ''; };
window.attachObserver = () => cssStyleObserver.attach(document.body);
