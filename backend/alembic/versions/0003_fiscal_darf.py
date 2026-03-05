from alembic import op
import sqlalchemy as sa

revision = "0003_fiscal_darf"
down_revision = "0002_auth_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fiscal_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("cpf", sa.String(length=14), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("cep", sa.String(length=16), nullable=True),
        sa.Column("street", sa.String(length=255), nullable=True),
        sa.Column("number", sa.String(length=32), nullable=True),
        sa.Column("complement", sa.String(length=128), nullable=True),
        sa.Column("neighborhood", sa.String(length=128), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=True),
        sa.Column("broker", sa.String(length=128), nullable=True),
        sa.Column("trading_account", sa.String(length=64), nullable=True),
        sa.Column("account_currency", sa.String(length=8), nullable=True),
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=True),
        sa.Column("fx_source", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", name="uq_fiscal_profiles_user_id"),
    )

    op.create_table(
        "darf_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("trades_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("profit_usd", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("profit_brl", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("fx_rate", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("tax_rate", sa.Numeric(6, 4), nullable=False, server_default="0.15"),
        sa.Column("tax_due", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="USD"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "year", "month", name="uq_darf_user_month"),
    )

    op.create_index("ix_fiscal_profiles_user_id", "fiscal_profiles", ["user_id"])
    op.create_index("ix_darf_reports_user_id", "darf_reports", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_darf_reports_user_id", table_name="darf_reports")
    op.drop_index("ix_fiscal_profiles_user_id", table_name="fiscal_profiles")
    op.drop_table("darf_reports")
    op.drop_table("fiscal_profiles")
