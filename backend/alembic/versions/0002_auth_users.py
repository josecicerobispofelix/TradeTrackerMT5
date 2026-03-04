from alembic import op
import sqlalchemy as sa

revision = "0002_auth_users"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("token", name="uq_sessions_token"),
    )

    op.create_table(
        "password_resets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("token_hash", name="uq_password_resets_token_hash"),
    )

    op.add_column("imports", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("trades", sa.Column("user_id", sa.Integer(), nullable=True))

    op.create_index("ix_imports_user_id", "imports", ["user_id"], unique=False)
    op.create_index("ix_trades_user_id", "trades", ["user_id"], unique=False)
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False)
    op.create_index(
        "ix_password_resets_user_id",
        "password_resets",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_password_resets_user_id", table_name="password_resets")
    op.drop_index("ix_sessions_user_id", table_name="sessions")
    op.drop_index("ix_trades_user_id", table_name="trades")
    op.drop_index("ix_imports_user_id", table_name="imports")

    op.drop_column("trades", "user_id")
    op.drop_column("imports", "user_id")

    op.drop_table("password_resets")
    op.drop_table("sessions")
    op.drop_table("users")
