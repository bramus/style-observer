/**
 * Structure representing a single Style Observer Change
 *
 * ```js
 * {
 *   "value": "1.0",
 *   "previousValue": "0.5",
 *   "changed": true,
 *   "element": HTMLElement
 * }
 * ```
 */
interface StyleObserverChange {
  value: string;
  previousValue: string;
  changed: boolean;
  element: HTMLElement;
}

/**
 * Structure holding several Style Observer Changes.
 *
 * ```js
 * {
 *   "--my-variable": {
 *     "value": "1.0",
 *     "previousValue": "0.5",
 *     "changed": true,
 *     "element": $element
 *   },
 *   "display": {
 *     "value": "block",
 *     "previousValue": "block",
 *     "changed": false,
 *     "element": $element
 *   }
 * }
 * ```
 */
type StyleObserverChanges = {
  [key: string]: StyleObserverChange;
};

/**
 * Structure holding several Style Observer Changes
 * with only their value
 *
 * ```json
 * {
 *   "--my-variable": "1.0",
 *   "display": "block",
 * }
 * ```
 */
type StyleObserverChangesValueOnly = {
  [key: string]: string;
};

export type CSSDeclarations =
  | StyleObserverChanges
  | StyleObserverChangesValueOnly;

/**
 * Type signature of observer callback.
 *
 * @param values Readonly structure containing observed CSS properties and their values
 */
export type CSSStyleObserverCallback = (
  values: Readonly<CSSDeclarations>
) => void;

/**
 * Type signatur for a formatter.
 * It is function that turns a set of StyleObserverChanges into CSSDeclarations
 */
type CSSStyleObserverFormatter = (
  changes: StyleObserverChanges
) => CSSDeclarations;

type CachedValues = { [key: string]: string };

/**
 * Supported return formats
 */
export enum ReturnFormat {
  VALUE_ONLY = 'value_only',
  OBJECT = 'object',
}

/**
 * Possible notification modes
 */
export enum NotificationMode {
  CHANGED_ONLY = 'changed_only',
  ALL = 'all',
}

/**
 * Options for configuring the CSSStyleObserver
 */
export interface CSSStyleObserverOptions {
  notificationMode?: NotificationMode;
  returnFormat?: ReturnFormat;
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
  // List of elements that are being observed
  _observedElements: Set<HTMLElement> = new Set();

  // Value cache per observed element
  _cachedValues: WeakMap<HTMLElement, CachedValues> = new WeakMap();

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
    this._notificationMode =
      options.notificationMode ?? NotificationMode.CHANGED_ONLY;
    this._returnFormat = options.returnFormat ?? ReturnFormat.VALUE_ONLY;
  }

  /**
   * Attach observer to target element. Callback will be invoked immediately with the current assigned values.
   *
   * @param targetElement target element
   */
  attach(targetElement: HTMLElement): void {
    if (!this._observedElements.has(targetElement)) {
      this._observedElements.add(targetElement);
      this._cachedValues.set(targetElement, {});

      this._setTargetElementStyles(targetElement);
      targetElement.addEventListener('transitionstart', this._eventHandler);

      // Make sure cache is not empty
      this._handleUpdate(targetElement);
    }
  }

  /**
   * Detach observer from given targetElement
   * If no argument is passed, then all are detached
   */
  detach(targetElement?: HTMLElement): void {
    // Figure out which elements to unwatch
    let elementsToUnwatch: Set<HTMLElement>;
    if (targetElement) {
      if (this._observedElements.has(targetElement)) {
        elementsToUnwatch = new Set([targetElement]);
      } else {
        elementsToUnwatch = new Set();
      }
    } else {
      elementsToUnwatch = this._observedElements;
    }

    // No elements to unwatch? Quit while you’re ahead
    if (!elementsToUnwatch.size) return;

    // Unwatch all that need unwatching
    elementsToUnwatch.forEach(elementToUnwatch => {
      this._unsetTargetElementStyles(elementToUnwatch);
      elementToUnwatch.removeEventListener(
        'transitionstart',
        this._eventHandler
      );

      this._observedElements.delete(elementToUnwatch);
      this._cachedValues.delete(elementToUnwatch);
    });
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
   * Mode to determine whether to observe all properties or only the changed ones
   */
  private _notificationMode: NotificationMode;

  /*
   * Format to determine how to return the observed values
   */
  private _returnFormat: ReturnFormat;

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
   * Process the computed style and collect the changes
   *
   * @param computedStyle The computed style of the target element
   * @returns Collected changes
   */
  private _processComputedStyle(
    computedStyle: CSSStyleDeclaration,
    targetElement: HTMLElement
  ): StyleObserverChanges {
    const changes: StyleObserverChanges = {};
    const cachedValuesForElement = this._cachedValues.get(targetElement) ?? {};

    this._observedVariables.forEach(propertyName => {
      const currentValue = computedStyle.getPropertyValue(propertyName);
      const previousValue = cachedValuesForElement[propertyName];
      const hasChanged = currentValue !== previousValue;

      if (this._notificationMode === NotificationMode.ALL || hasChanged) {
        changes[propertyName] = {
          value: currentValue,
          previousValue,
          changed: hasChanged,
          element: targetElement,
        };
        cachedValuesForElement[propertyName] = currentValue;
      }
    });

    return changes;
  }

  /**
   * Returns the formatter to use
   */
  private _getFormatter(format: ReturnFormat): CSSStyleObserverFormatter {
    switch (format) {
      case ReturnFormat.OBJECT:
        return changes => {
          return changes;
        };

      case ReturnFormat.VALUE_ONLY:
      default:
        return changes => {
          const formattedChanges: StyleObserverChangesValueOnly = {};
          Object.keys(changes).forEach(key => {
            formattedChanges[key] = changes[key].value;
          });
          return formattedChanges;
        };
    }
  }

  /**
   * Collect CSS variable values and invoke callback.
   */
  private _handleUpdate(e: TransitionEvent | HTMLElement): void {
    const targetElement =
      e instanceof HTMLElement ? e : (e.target as HTMLElement);

    if (this._observedElements.has(targetElement)) {
      const computedStyle = getComputedStyle(targetElement);
      const changes = this._processComputedStyle(computedStyle, targetElement);

      if (Object.keys(changes).length === 0) return;

      const formatter = this._getFormatter(this._returnFormat);
      this._callback(formatter(changes));
    }
  }
}

export default CSSStyleObserver;
