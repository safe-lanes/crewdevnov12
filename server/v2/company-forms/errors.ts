export class CompanyFormPermissionError extends Error {
  readonly statusCode = 403;
  readonly code = "forbidden";

  constructor(message = "You do not have permission to access this Company Form subject.") {
    super(message);
    this.name = "CompanyFormPermissionError";
  }
}

export class CompanyFormAuthenticationError extends Error {
  readonly statusCode = 401;
  readonly code = "unauthorized";

  constructor(message = "Authentication is required to access Company Forms.") {
    super(message);
    this.name = "CompanyFormAuthenticationError";
  }
}

export class UnsupportedCompanyFormSubjectError extends Error {
  readonly statusCode = 400;
  readonly code = "unsupported_subject_type";

  constructor(subjectType: string) {
    super(`Company Form subject type "${subjectType}" is not supported.`);
    this.name = "UnsupportedCompanyFormSubjectError";
  }
}

export class CompanyFormNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "not_found";

  constructor(message: string) {
    super(message);
    this.name = "CompanyFormNotFoundError";
  }
}

export class CompanyFormConflictError extends Error {
  readonly statusCode = 409;
  readonly code = "conflict";

  constructor(message: string) {
    super(message);
    this.name = "CompanyFormConflictError";
  }
}

export class CompanyFormValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "invalid_request";

  constructor(message: string) {
    super(message);
    this.name = "CompanyFormValidationError";
  }
}