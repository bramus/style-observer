/**
 * Structure holding CSS computed values. Example:
 *
 * ```json
 * {
 *     "--my-variable": "1.0",
 *     "display": "block"
 * }
 * ```
 */
export type CSSDeclarations = { [key: string]: string };

/**
 * Type signature of observer callback.
 *
 * @param values Readonly structure containing observed CSS properties and their values
 */
export type CSSStyleObserverCallback = (
  values: Readonly<CSSDeclarations>
) => void;

/**
 * Enum for callback modes
 */
export enum CallbackMode {
  ALL = 'all',
  INDIVIDUAL = 'individual'
}

/**
 * Options for configuring the CSSStyleObserver
 */
export interface CSSStyleObserverOptions {
  callbackMode?: CallbackMode;
}

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
   * @param options configuration options
   */
  constructor(
    observedVariables: string[],
    callback: CSSStyleObserverCallback,
    options: CSSStyleObserverOptions = {}
  ) {
    this._observedVariables = observedVariables;
    this._callback = callback;
    this._targetElement = null;
    this._callbackMode = options.callbackMode ?? CallbackMode.INDIVIDUAL;
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
   * Mode for the callback to decide what to pass
   */
  private _callbackMode: CallbackMode;

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

  private modeHandlers: Record<CallbackMode, (computedStyle: CSSStyleDeclaration, variables: CSSDeclarations, propertyName?: string) => void> = {
    [CallbackMode.ALL]: (computedStyle, variables) => {
      this._observedVariables.forEach(value => {
        variables[value] = computedStyle.getPropertyValue(value);
      });
    },
    [CallbackMode.INDIVIDUAL]: (computedStyle, variables, propertyName) => {
      if (propertyName) {
        variables[propertyName] = computedStyle.getPropertyValue(propertyName);
      }
    }
    // Additional modes
  };

  /**
   * Collect CSS variable values and invoke callback.
   */
  private _handleUpdate(event?: TransitionEvent): void {
    if (this._targetElement) {
      const propertyName = event?.propertyName;

      // Early return if the property is given but not observed
      if (propertyName && !this._observedVariables.includes(propertyName)) {
        return;
      }

      const computedStyle = getComputedStyle(this._targetElement);

      const variables: CSSDeclarations = {};

      // Execute the handler for the current mode, default to CallbackMode.INDIVIDUAL if not valid
      const handler = this.modeHandlers[this._callbackMode] ?? this.modeHandlers[CallbackMode.INDIVIDUAL];
      handler(computedStyle, variables, propertyName);

      // Do not invoke callback if no variables are defined
      if (Object.keys(variables).length > 0) {
        this._callback(variables);
      }
    }
  }
}

export default CSSStyleObserver;
