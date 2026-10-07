class ErrorHandler extends Error{
    statusCode: Number;
    constructor(message: any, statusCode: Number){
        super(message);
        this.statusCode = statusCode;

        Error.captureStackTrace(this, this.constructor);
    }
}

export default ErrorHandler;

/*
ErrorHandler is a custom error class that inherits features from JavaScript's built-in Error class.

constructor(message, statusCode):
- constructor runs automatically when new object is created
- message and statusCode are parameters passed during object creation

super(message):
- calls parent Error class constructor
- automatically stores error message in this.message
- that's why we don't write this.message = message manually

this.statusCode = statusCode:
- this = current object being created
- left side (this.statusCode) creates/stores property inside object
- right side (statusCode) is incoming parameter value
- Error class does not have the property of statusCode. It is customized by us that's why is is not declared as message

What is Error.captureStackTrace()?
- It is a built-in Node.js method.
- Its purpose is to Create a clean stack trace for a custom error object by removing unnecessary constructor calls.
- Syntax: Error.captureStackTrace(targetObject, constructorFunction);
It takes two parameters.

------------------------------------------------
When you do:

new ErrorHandler("Invalid Credentials", 401);
------------------------------------------------

JavaScript creates a new ErrorHandler object.

Inside the constructor:

'this'

refers to that newly created object.

So conceptually:

new ErrorHandler(...)
        ↓
New ErrorHandler object
        ↓
this

Therefore:

Error.captureStackTrace(this, ...)

means:

"Create the stack trace and attach it to this ErrorHandler error object."

2. What is this.constructor?

Every JavaScript object has access to a constructor property that points to the function/class that created that object.

Here:

this.constructor

means:

"What constructor/class was used to create this object?"

Your object was created using:

new ErrorHandler(...)

Therefore: this.constructor
refers to: ErrorHandler

So these are effectively equivalent here:

Error.captureStackTrace(this, this.constructor);

and:

Error.captureStackTrace(this, ErrorHandler);

3. Why pass this.constructor as the second parameter?

The syntax is: Error.captureStackTrace(targetObject, constructorFunction);

You are telling Node.js:

Error.captureStackTrace(
    this,              // error object
    this.constructor   // ErrorHandler constructor
);

The second parameter tells Node.js:

"Start the useful stack trace after this constructor."

So the ErrorHandler constructor itself does not unnecessarily appear as the starting point of the stack trace.

Simple mental model
new ErrorHandler()
       ↓
ErrorHandler constructor
       ↓
captureStackTrace(this, this.constructor)
       ↓
Skip ErrorHandler constructor
       ↓
Show where the error was actually created
In one sentence

this = the current ErrorHandler error object, while this.constructor = the ErrorHandler class that created that object; passing both to captureStackTrace() creates a cleaner stack trace that starts from the code that actually caused the error.

Without captureStackTrace()

Call Stack:

loginUser()
    ↓
new ErrorHandler()
    ↓
Error.captureStackTrace()

Stack Trace:

Error: Invalid Credentials
at ErrorHandler (...)
at loginUser (...)
at app.js (...)

Notice:
- The constructor (ErrorHandler) appears in the stack trace, which is usually unnecessary.

-------------------------------------------

With captureStackTrace(this, this.constructor)

Node.js finds the ErrorHandler constructor in the call stack and removes:

- Error.captureStackTrace()
- ErrorHandler()

The resulting stack trace becomes:

Error: Invalid Credentials
at loginUser (...)
at app.js (...)

Now the stack trace starts from the place where the error was actually created, making debugging easier.

-------------------------------------------
*/