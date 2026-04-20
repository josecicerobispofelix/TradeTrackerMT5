import datetime as dt
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_session
from ..models import RobotTest, User
from ..schemas import RobotTestIn, RobotTestOut

try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.platypus import Table, TableStyle
except Exception:
    rl_canvas = None

router = APIRouter()


@router.get("/robot-tests", response_model=List[RobotTestOut])
async def list_robot_tests(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    rows = await session.scalars(
        select(RobotTest)
        .where(RobotTest.user_id == user.id)
        .order_by(RobotTest.test_date.desc(), RobotTest.id.desc())
    )
    result = []
    for r in rows:
        result.append(RobotTestOut(
            id=r.id,
            robot_name=r.robot_name,
            test_date=r.test_date,
            session=r.session,
            start_time=r.start_time,
            end_time=r.end_time,
            total_trades=r.total_trades or 0,
            take_profits=r.take_profits or 0,
            stop_losses=r.stop_losses or 0,
            gross_profit=r.gross_profit or 0.0,
            gross_loss=r.gross_loss or 0.0,
            currency=r.currency or "USD",
            notes=r.notes,
            created_at=r.created_at.isoformat() if r.created_at else "",
        ))
    return result


@router.post("/robot-tests", response_model=RobotTestOut)
async def create_robot_test(
    payload: RobotTestIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    row = RobotTest(
        user_id=user.id,
        robot_name=payload.robot_name,
        test_date=payload.test_date,
        session=payload.session,
        start_time=payload.start_time,
        end_time=payload.end_time,
        total_trades=payload.total_trades,
        take_profits=payload.take_profits,
        stop_losses=payload.stop_losses,
        gross_profit=payload.gross_profit,
        gross_loss=payload.gross_loss,
        currency=payload.currency,
        notes=payload.notes,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return RobotTestOut(
        id=row.id,
        robot_name=row.robot_name,
        test_date=row.test_date,
        session=row.session,
        start_time=row.start_time,
        end_time=row.end_time,
        total_trades=row.total_trades or 0,
        take_profits=row.take_profits or 0,
        stop_losses=row.stop_losses or 0,
        gross_profit=row.gross_profit or 0.0,
        gross_loss=row.gross_loss or 0.0,
        currency=row.currency or "USD",
        notes=row.notes,
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


@router.delete("/robot-tests/{test_id}")
async def delete_robot_test(
    test_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    row = await session.scalar(
        select(RobotTest).where(RobotTest.id == test_id, RobotTest.user_id == user.id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Teste não encontrado")
    await session.delete(row)
    await session.commit()
    return {"ok": True}


def _build_robot_pdf(tests: List[RobotTestOut]) -> bytes:
    if rl_canvas is None:
        raise HTTPException(status_code=500, detail="PDF indisponível")

    buffer = BytesIO()
    page_size = landscape(A4)
    pdf = rl_canvas.Canvas(buffer, pagesize=page_size)
    width, height = page_size

    # Header
    y = height - 40
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, "Relatório de Testes de Robô – TradersTrackerMT5")
    y -= 20
    pdf.setFont("Helvetica", 9)
    pdf.drawString(40, y, f"Gerado em: {dt.datetime.now().strftime('%d/%m/%Y %H:%M')}")
    y -= 20

    # Totals summary
    total_trades = sum(t.total_trades for t in tests)
    total_tp = sum(t.take_profits for t in tests)
    total_sl = sum(t.stop_losses for t in tests)
    total_profit = sum(t.gross_profit for t in tests)
    total_loss = sum(t.gross_loss for t in tests)
    net = total_profit - total_loss
    win_rate = (total_tp / total_trades * 100) if total_trades > 0 else 0.0

    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(40, y, "Resumo Geral")
    y -= 14
    pdf.setFont("Helvetica", 9)
    pdf.drawString(40, y, f"Total de testes: {len(tests)}   |   Total de trades: {total_trades}   |   Take Profits: {total_tp}   |   Stop Losses: {total_sl}   |   Taxa de acerto: {win_rate:.1f}%")
    y -= 12
    currency = tests[0].currency if tests else "USD"
    pdf.drawString(40, y, f"Lucro bruto: {total_profit:,.2f} {currency}   |   Perda bruta: {total_loss:,.2f} {currency}   |   Resultado líquido: {net:,.2f} {currency}")
    y -= 20

    # Table header
    col_widths = [100, 65, 65, 60, 60, 45, 40, 40, 70, 70, 70, 120]
    headers = ["Robô", "Data", "Sessão", "Início", "Fim", "Trades", "TPs", "SLs", "Lucro", "Perda", "Resultado", "Notas"]

    def draw_row(row_data, y_pos, is_header=False):
        x = 40
        pdf.setFont("Helvetica-Bold" if is_header else "Helvetica", 8)
        bg = colors.HexColor("#1a3a5c") if is_header else None
        if bg:
            pdf.setFillColor(bg)
            pdf.rect(40, y_pos - 4, sum(col_widths), 14, fill=1, stroke=0)
            pdf.setFillColor(colors.white)
        else:
            pdf.setFillColor(colors.black)
        for i, cell in enumerate(row_data):
            pdf.drawString(x + 2, y_pos, str(cell)[:18])
            x += col_widths[i]
        pdf.setFillColor(colors.black)

    draw_row(headers, y, is_header=True)
    y -= 16

    for idx, t in enumerate(tests):
        if y < 40:
            pdf.showPage()
            y = height - 40
            draw_row(headers, y, is_header=True)
            y -= 16

        net_row = t.gross_profit - t.gross_loss
        row_data = [
            t.robot_name[:14],
            t.test_date,
            t.session or "-",
            t.start_time or "-",
            t.end_time or "-",
            t.total_trades,
            t.take_profits,
            t.stop_losses,
            f"{t.gross_profit:,.2f}",
            f"{t.gross_loss:,.2f}",
            f"{net_row:,.2f}",
            (t.notes or "")[:18],
        ]
        # Alternate row background
        if idx % 2 == 0:
            pdf.setFillColor(colors.HexColor("#f0f4f8"))
            pdf.rect(40, y - 4, sum(col_widths), 13, fill=1, stroke=0)
            pdf.setFillColor(colors.black)

        # Net result color
        x = 40
        pdf.setFont("Helvetica", 8)
        for i, cell in enumerate(row_data):
            if i == 10:  # Resultado column
                pdf.setFillColor(colors.HexColor("#16a34a") if net_row >= 0 else colors.HexColor("#dc2626"))
            else:
                pdf.setFillColor(colors.black)
            pdf.drawString(x + 2, y, str(cell))
            x += col_widths[i]
        pdf.setFillColor(colors.black)
        y -= 14

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


@router.post("/robot-tests/pdf")
async def robot_tests_pdf(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    rows = await session.scalars(
        select(RobotTest)
        .where(RobotTest.user_id == user.id)
        .order_by(RobotTest.test_date.desc())
    )
    tests = []
    for r in rows:
        tests.append(RobotTestOut(
            id=r.id,
            robot_name=r.robot_name,
            test_date=r.test_date,
            session=r.session,
            start_time=r.start_time,
            end_time=r.end_time,
            total_trades=r.total_trades or 0,
            take_profits=r.take_profits or 0,
            stop_losses=r.stop_losses or 0,
            gross_profit=r.gross_profit or 0.0,
            gross_loss=r.gross_loss or 0.0,
            currency=r.currency or "USD",
            notes=r.notes,
            created_at=r.created_at.isoformat() if r.created_at else "",
        ))

    if not tests:
        raise HTTPException(status_code=400, detail="Nenhum teste registrado")

    pdf_bytes = _build_robot_pdf(tests)
    filename = f"testes_robo_{dt.datetime.now().strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
