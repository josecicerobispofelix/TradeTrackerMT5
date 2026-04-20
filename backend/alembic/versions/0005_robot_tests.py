"""robot_tests table

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_robot_tests"
down_revision = "0004_trade_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "robot_tests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("robot_name", sa.String(100), nullable=False),
        sa.Column("test_date", sa.String(10), nullable=False),
        sa.Column("session", sa.String(20), nullable=True),
        sa.Column("start_time", sa.String(5), nullable=True),
        sa.Column("end_time", sa.String(5), nullable=True),
        sa.Column("total_trades", sa.Integer(), default=0),
        sa.Column("take_profits", sa.Integer(), default=0),
        sa.Column("stop_losses", sa.Integer(), default=0),
        sa.Column("gross_profit", sa.Float(), default=0.0),
        sa.Column("gross_loss", sa.Float(), default=0.0),
        sa.Column("currency", sa.String(5), default="USD"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_robot_tests_user_id", "robot_tests", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_robot_tests_user_id", "robot_tests")
    op.drop_table("robot_tests")
