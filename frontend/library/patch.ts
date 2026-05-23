
export function wrapReturnValue(
  object: any,
  property: string,
  handler: (args: any[], returnValue: any) => any,
): void {
  const original = object[property];
  object[property] = function(this: any, ...args: any[]) {
    return handler.call(this, args, original.call(this, ...args));
  };
  object[property].toString = () => original.toString();
}
