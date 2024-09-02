/**
 * Structure holding detailed CSS computed values. Example:
 *
 * ```json
 * {
 *     "propertyName": "--my-variable",
 *     "value": "1.0",
 *     "previousValue": "0.5",
 *     "changed": true
 * }
 * ```
 */
export type CSSDeclarations = {
  propertyName: string;
  value: string;
  previousValue: string;
  changed: boolean;
};

/**
 * Type signature of observer callback.
 *
 * @param values Readonly Array containing details of observed CSS properties and their change status
 */
export type CSSStyleObserverCallback = (
  values: ReadonlyArray<CSSDeclarations>
) => void;

/**
 * Passive observer for CSS properties. Instead of typical polling approach, it uses CSS
 * transitions to detect changes.
 *
 * CSSStyleObserver can be used to build dynamic theming system, detect media etc.
 *
 * Usage:
 * ```javascript
 * const cssStyleObserver = new CSSStyleObserver(['--my-variable'], (variables) => console.log("Value:",variables['--my-variable']));
 * cssStyleObserver.attach(document.body);
 * ```
 */
export class CSSStyleObserver {
  /**
   * Create a new (detached) instance of CSS variable observer.
   *
   * @param observedVariables list of CSS variables to observe
   * @param callback callback that will be invoked every time any of listed CSS variables change
   */
  constructor(
    observedVariables: string[],
    callback: CSSStyleObserverCallback
  ) {
    this._observedVariables = observedVariables;
    this._callback = callback;
    this._targetElement = null;
    this._cachedValues = {};
  }

  /**
   * Attach observer to target element. Callback will be invoked immediately with the current assigned values.
   *
   * @param targetElement target element
   */
  attach(targetElement: HTMLElement): void {
    if (!this._targetElement) {
      this._targetElement = targetElement;
      this._setTargetElementStyles(this._targetElement);
      this._targetElement.addEventListener('transitionstart', this._eventHandler);
      this._handleUpdate();
    }
  }

  /**
   * Detach observer.
   */
  detach(): void {
    if (this._targetElement) {
      this._unsetTargetElementStyles(this._targetElement);
      this._targetElement.removeEventListener('transitionstart', this._eventHandler);
      this._targetElement = null;
    }
  }

  /*
   * Observer CSS variables and their internal identifiers.
   */
  private _observedVariables: string[];

  /*
   * User supplied callback that receives CSS variable values.
   */
  private _callback: CSSStyleObserverCallback;

  /*
   * Event handler that is used to invoke callback.
   */
  private _eventHandler = this._handleUpdate.bind(this);

  /*
   * The element that is being observed
   */
  private _targetElement: HTMLElement | null;

  /*
   * Cache to store previous values of observed properties
   */
  private _cachedValues: { [key: string]: string };

  /**
   * Attach the styles necessary to track the changes to the given element
   * 
   * @param targetElement The element to track
   */
  private _setTargetElementStyles(targetElement: HTMLElement): void {
    const cssTransitionValue = this._observedVariables
      .map(value => `${value} 0.001ms step-start`)
      .join(', ');

    // @TODO: Don’t overwrite the existing transition
    targetElement.style.setProperty('transition', cssTransitionValue);
    targetElement.style.setProperty('transition-behavior', 'allow-discrete');
  }

  /**
   * Remove the styles that track the property changes
   * 
   * @param targetElement The element to track
   */
  private _unsetTargetElementStyles(targetElement: HTMLElement): void {
    // @TODO: Don’t remove all, only remove the tracked variables
    targetElement.style.removeProperty('transition');
    targetElement.style.removeProperty('transition-behavior');
  }

  /**
   * Collect CSS variable values and invoke callback.
   */
  private _handleUpdate(): void {
    if (this._targetElement) {
      const computedStyle = getComputedStyle(this._targetElement);
  
      const results: CSSDeclarations[] = [];
  
      this._observedVariables.forEach(propertyName => {
        const currentValue = computedStyle.getPropertyValue(propertyName);
        const previousValue = this._cachedValues[propertyName] || '';
  
        const changed = currentValue !== previousValue;
  
        results.push({
          propertyName,
          value: currentValue,
          previousValue,
          changed
        });
  
        this._cachedValues[propertyName] = currentValue;
      });
  
      // Invoke the callback only if there are changes
      if (results.some(detail => detail.changed)) {
        this._callback(results);
      }
    }
  }
}

export default CSSStyleObserver;
