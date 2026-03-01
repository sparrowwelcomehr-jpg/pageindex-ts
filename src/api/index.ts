/**
 * API module exports
 */

export { DocumentController } from './DocumentController';
export { createRouter } from './routes';
export { 
  errorHandler, 
  notFoundHandler, 
  requestLogger,
  HttpError,
  NotFoundError,
  ValidationError 
} from './middleware';
