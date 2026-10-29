import '@testing-library/jest-dom';

// jsdom has no layout, so it doesn't implement scrollIntoView, which the bracket calls when a match opens.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
