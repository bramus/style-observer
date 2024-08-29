# CSS Variable Observer

Zero-dependency, tiny (~800B) CSS variable (custom property) observer

![npm](https://img.shields.io/npm/v/css-variable-observer)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/css-variable-observer)
![NPM](https://img.shields.io/npm/l/css-variable-observer)

## Problem

While CSS variables (a.k.a. [CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)) are 
very powerful, their integration with JavaScript is very limited: you can set it with `element.style.setProperty()`
or retrieve expanded value with `getComputedStyle(element).getProperty()`. Moreover, if you add `calc()` to the mix
(why else would you use CSS variables otherwise), you'll quickly notice that `getProperty()` doesn't returns computed
value, but an expanded formula.

Not to mention that it's not possible to observe CSS variable from the JavaScript side.

## Solution

This tiny library addresses both problems. It allows you to set up an observer that will track specified
CSS variables and retrieve their final computed values.

![Demo](demo/demo-recording.gif)

Note: Does not work in Google Chrome because of https://crbug.com/360159391

## Usage

`npm install css-variable-observer --save`


```js
// Vanilla JS (CommonJS)
const CSSVariableObserver = require('css-variable-observer');

// Vanilla JS (ES6)
import CSSVariableObserver from 'css-variable-observer';

// TypeScript
import CSSVariableObserver from 'css-variable-observer/src/index.ts'

const cssVariableObserver = new CSSVariableObserver(
        ['--variable1', '--variable2'],     /* CSS Variables to observe */
        (variables) => {                    /* This is called whenever there are changes */
            console.log(variables['--variable1'], variables['--variable2']);
        }                               
    );
cssVariableObserver.attach(document.body);  /* Attach observer */

//...

cssVariableObserver.detach();               /* Detach observer */
```

## Local Development

Below is a list of commands you will probably find useful.

### `npm run demo`

Runs the project in development/watch mode, starts HTTP server and navigates to `http://localhost:8080/demo` 

### `npm start`

Runs the project in development/watch mode. Your project will be rebuilt upon changes. 

### `npm run build`

Bundles the package to the `dist` folder.
The package is optimized and bundled with Rollup into multiple formats (CommonJS, UMD, and ES Module).
