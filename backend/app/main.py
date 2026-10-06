import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from app.api.v1.routes import analysis, auth, history, doctor, patient
from app.core.config import settings
from app.database.models import Base
from app.database.session import engine
from app.services.model_manager import model_manager
from app.middleware.request_logging import RequestLoggingMiddleware
logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(name)s %(message)s')
import asyncio
@asynccontextmanager
async def lifespan(app:FastAPI):
    async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)
    # Warm the models in a worker thread, but never block startup on it: the
    # services call ensure_loaded() and wait for this same load to finish.
    async def warm():
        try: await asyncio.to_thread(model_manager.load)
        except Exception: logging.getLogger(__name__).exception('Model warmup failed')
    asyncio.create_task(warm())
    yield
    await engine.dispose()
limiter=Limiter(key_func=get_remote_address)
app=FastAPI(title=settings.app_name,version='1.0.0',description='Multi-agent emotional intelligence inference API.',lifespan=lifespan)
app.state.limiter=limiter; app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CORSMiddleware,allow_origins=[x.strip() for x in settings.cors_origins.split(',')],allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
app.add_middleware(RequestLoggingMiddleware)
@app.exception_handler(RateLimitExceeded)
async def rate_handler(_:Request,exc:RateLimitExceeded): return JSONResponse(status_code=429,content={'detail':'Rate limit exceeded'})
@app.get('/health',tags=['Operational'])
async def health(): return {'status':'healthy','models_loaded':model_manager.ready}
@app.get('/api/health',tags=['Operational'],summary='Verify API and model readiness')
async def api_health():
    """Return a lightweight readiness response suitable for deployment probes."""
    return {
        'status': 'healthy',
        'models_loaded': model_manager.ready,
        'text_ready': model_manager.text_models_ready(),
        'safety_ready': model_manager.suicide_models_ready(),
        'voice_ready': model_manager.voice_models_ready(),
    }
app.include_router(auth.router, prefix='/api'); app.include_router(analysis.router, prefix='/api'); app.include_router(history.router, prefix='/api'); app.include_router(doctor.router, prefix='/api'); app.include_router(patient.router, prefix='/api')
