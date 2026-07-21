import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders its label as a semantic button', () => {
    render(<Button>开始游戏</Button>)

    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument()
  })

  it('calls onClick exactly once', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>确认</Button>)

    await user.click(screen.getByRole('button', { name: '确认' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>不可用</Button>)

    await user.click(screen.getByRole('button', { name: '不可用' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not call onClick while loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>提交中</Button>)

    const button = screen.getByRole('button', { name: '提交中' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)

    expect(onClick).not.toHaveBeenCalled()
  })

  it.each(['sm', 'md', 'lg'] as const)('keeps size %s as a semantic button', (size) => {
    render(<Button size={size}>尺寸 {size}</Button>)

    expect(screen.getByRole('button', { name: `尺寸 ${size}` })).toBeInTheDocument()
  })

  it.each(['primary', 'secondary', 'accent', 'danger'] as const)('keeps variant %s as a semantic button', (variant) => {
    render(<Button variant={variant}>样式 {variant}</Button>)

    expect(screen.getByRole('button', { name: `样式 ${variant}` })).toBeInTheDocument()
  })
})
