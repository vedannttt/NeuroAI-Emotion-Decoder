"""add doctor clinical features
Revision ID: 0002_add_doctor_features
"""
from alembic import op
import sqlalchemy as sa
revision = '0002_add_doctor_features'
down_revision = '0001_initial'
branch_labels = None
depends_on = None
def upgrade():
    op.add_column('users', sa.Column('doctor_id', sa.String(80), nullable=True))
    op.create_unique_constraint('uq_users_doctor_id', 'users', ['doctor_id'])

    op.create_table(
        'session_notes',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('doctor_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('patient_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.JSON, nullable=False),
        sa.Column('is_draft', sa.Boolean, server_default=sa.true()),
        sa.Column('session_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_session_notes_doctor_id', 'session_notes', ['doctor_id'])
    op.create_index('ix_session_notes_patient_id', 'session_notes', ['patient_id'])

    op.create_table(
        'appointments',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('doctor_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('patient_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('appointment_type', sa.String(60), server_default='consultation'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('status', sa.String(30), server_default='scheduled'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_appointments_doctor_id', 'appointments', ['doctor_id'])
    op.create_index('ix_appointments_patient_id', 'appointments', ['patient_id'])

    op.create_table(
        'doctor_alerts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('doctor_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('patient_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('alert_type', sa.String(60), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('severity', sa.String(20), server_default='info'),
        sa.Column('seen', sa.Boolean, server_default=sa.false()),
        sa.Column('analysis_id', sa.Integer, sa.ForeignKey('analysis_history.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_doctor_alerts_doctor_id', 'doctor_alerts', ['doctor_id'])
    op.create_index('ix_doctor_alerts_patient_id', 'doctor_alerts', ['patient_id'])
def downgrade():
    op.drop_index('ix_doctor_alerts_patient_id', table_name='doctor_alerts')
    op.drop_index('ix_doctor_alerts_doctor_id', table_name='doctor_alerts')
    op.drop_table('doctor_alerts')

    op.drop_index('ix_appointments_patient_id', table_name='appointments')
    op.drop_index('ix_appointments_doctor_id', table_name='appointments')
    op.drop_table('appointments')

    op.drop_index('ix_session_notes_patient_id', table_name='session_notes')
    op.drop_index('ix_session_notes_doctor_id', table_name='session_notes')
    op.drop_table('session_notes')

    op.drop_constraint('uq_users_doctor_id', 'users', type_='unique')
    op.drop_column('users', 'doctor_id')
