export function Panel({ title, subtitle, children, action }) {
    return (<section className="panel">
                                                <div className="panel-head">
                                                                <div>
                                                                                <h3>{title}</h3>
                                                                                {subtitle && <p>{subtitle}</p>}
                                                                </div>
                                                                {action}
                                                </div>
                                                {children}
                                </section>);
}
