from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "imports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("file_hash", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("account", sa.String(length=64), nullable=True),
        sa.Column("server", sa.String(length=128), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("report_start", sa.Date(), nullable=True),
        sa.Column("report_end", sa.Date(), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False),
        sa.Column("inserted_rows", sa.Integer(), nullable=False),
        sa.Column("skipped_rows", sa.Integer(), nullable=False),
        sa.Column("meta_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("file_hash", name="uq_imports_file_hash"),
    )

    op.create_table(
        "fx_rates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("usd_brl_rate", sa.Numeric(18, 6), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("date", name="uq_fx_rates_date"),
    )

    op.create_table(
        "trades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account", sa.String(length=64), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("side", sa.String(length=8), nullable=False),
        sa.Column("volume", sa.Numeric(18, 6), nullable=False),
        sa.Column("open_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("close_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open_price", sa.Numeric(18, 6), nullable=False),
        sa.Column("close_price", sa.Numeric(18, 6), nullable=False),
        sa.Column("profit", sa.Numeric(18, 6), nullable=False),
        sa.Column("commission", sa.Numeric(18, 6), nullable=False),
        sa.Column("swap", sa.Numeric(18, 6), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("deal_id", sa.String(length=64), nullable=True),
        sa.Column("trade_uid", sa.String(length=128), nullable=False),
        sa.Column("close_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("trade_uid", name="uq_trades_trade_uid"),
    )

    op.create_index("ix_trades_account", "trades", ["account"], unique=False)
    op.create_index("ix_trades_symbol", "trades", ["symbol"], unique=False)
    op.create_index("ix_trades_close_date", "trades", ["close_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_trades_close_date", table_name="trades")
    op.drop_index("ix_trades_symbol", table_name="trades")
    op.drop_index("ix_trades_account", table_name="trades")
    op.drop_table("trades")
    op.drop_table("fx_rates")
    op.drop_table("imports")
