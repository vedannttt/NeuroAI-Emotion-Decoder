"""initial NeuroAI schema
Revision ID: 0001_initial
"""
from alembic import op
import sqlalchemy as sa
revision='0001_initial'; down_revision=None; branch_labels=None; depends_on=None
def upgrade():
    op.create_table('users',sa.Column('id',sa.Integer,primary_key=True),sa.Column('email',sa.String(320),nullable=False,unique=True),sa.Column('full_name',sa.String(120),nullable=False),sa.Column('password_hash',sa.String(255),nullable=False),sa.Column('role',sa.String(30),nullable=False,server_default='user'),sa.Column('is_active',sa.Boolean,nullable=False,server_default=sa.true()),sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now()))
    op.create_table('analysis_history',sa.Column('id',sa.Integer,primary_key=True),sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id'),nullable=False),sa.Column('report_type',sa.String(30),nullable=False),sa.Column('result',sa.JSON,nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now()))
    op.create_table('phq_reports',sa.Column('id',sa.Integer,primary_key=True),sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id'),nullable=False),sa.Column('score',sa.Integer,nullable=False),sa.Column('severity',sa.String(40),nullable=False),sa.Column('answers',sa.JSON,nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now()))
    for table in ['emotion_reports','voice_reports']:
        op.create_table(table,sa.Column('id',sa.Integer,primary_key=True),sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id'),nullable=False),sa.Column('emotion',sa.String(60),nullable=False),sa.Column('confidence',sa.Float,nullable=False),sa.Column('result',sa.JSON,nullable=False),sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now()))
    op.create_table('settings',sa.Column('id',sa.Integer,primary_key=True),sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id'),nullable=False,unique=True),sa.Column('preferences',sa.JSON,nullable=False))
    op.create_table('audit_logs',sa.Column('id',sa.Integer,primary_key=True),sa.Column('user_id',sa.Integer,sa.ForeignKey('users.id'),nullable=True),sa.Column('action',sa.String(100),nullable=False),sa.Column('detail',sa.Text,nullable=True),sa.Column('created_at',sa.DateTime(timezone=True),server_default=sa.func.now()))
    op.create_index('ix_analysis_history_user_id','analysis_history',['user_id'])
def downgrade():
    op.drop_index('ix_analysis_history_user_id',table_name='analysis_history')
    for table in ['audit_logs','settings','voice_reports','emotion_reports','phq_reports','analysis_history','users']: op.drop_table(table)
