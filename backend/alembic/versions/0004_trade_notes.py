from alembic import op
import sqlalchemy as sa

revision = "0004_trade_notes"
down_revision = "0003_fiscal_darf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("trades", "note")
