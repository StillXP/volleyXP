// jsdom has no layout, so it doesn't implement scrollIntoView, which the bracket calls when a match opens.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
